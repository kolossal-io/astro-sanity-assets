import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";
import type { AstroIntegration, AstroIntegrationLogger } from "astro";
import axios from "axios";
import {
  type ClientConfig,
  createClient,
  type SanityClient,
} from "@sanity/client";

type SanityFileAsset = {
  extension?: string;
  assetId?: string;
  url?: string;
};

export type FileAssetType = {
  url: string;
  filename: string;
  sha1hash?: string;
};

type Handler<T = SanityFileAsset> = (
  data: T
) => FileAssetType | undefined | null;

interface DownloadSanityAssetsProps<D, Q extends string> extends ClientConfig {
  directory: string;
  query: Q;
  handler?: Handler<D>;
}

type DownloadSanityAssetsPropsWithHandler<D, Q extends string> = Omit<
  DownloadSanityAssetsProps<D, Q>,
  "handler"
> & {
  handler: Handler<D>;
};

type AstroBuildStartOptions = {
  logger: AstroIntegrationLogger;
};

async function checkIfFileHasNotChanged(
  filePath: string,
  remoteSha1: string
): Promise<boolean> {
  if (!existsSync(filePath)) {
    return false;
  }

  const sha1 = await new Promise((resolveHash, reject) => {
    const hash = createHash("sha1");
    const stream = createReadStream(filePath);

    stream.on("error", (err) => reject(err));

    stream.on("data", (chunk) => {
      hash.update(chunk);
    });

    stream.on("end", () => {
      resolveHash(hash.digest("hex"));
    });
  });

  return sha1 === remoteSha1;
}

async function fetchAssetUrls<R, Q extends string = string>(
  query: Q,
  config: ClientConfig,
  options?: AstroBuildStartOptions
): Promise<R[]> {
  let client: SanityClient;

  try {
    client = createClient(config);
  } catch (e) {
    options?.logger.error(
      "Could not create Sanity client. Please check the configuration."
    );
    throw e;
  }

  options?.logger.debug("Collecting assets from Sanity…");

  return await client.fetch<R[]>(query);
}

function downloadSanityAssets<D = SanityFileAsset, Q extends string = string>(
  config: DownloadSanityAssetsProps<D, Q>
): AstroIntegration;

function downloadSanityAssets<D, Q extends string = string>(
  config: DownloadSanityAssetsPropsWithHandler<D, Q>
): AstroIntegration;

function downloadSanityAssets<D, Q extends string = string>({
  directory,
  query,
  handler: handlerProp,
  ...sanityConfig
}: DownloadSanityAssetsProps<D, Q>): AstroIntegration {
  let createdFolder = false;

  const handler: Handler<D> =
    handlerProp ??
    ((data: any) => {
      const file = data as SanityFileAsset;

      return file.url && file.assetId && file.extension
        ? {
            url: data.url,
            filename: `${data.assetId}.${data.extension}`,
            sha1hash: data.sha1hash,
          }
        : undefined;
    });

  function getFolderPath(): string {
    return resolve("public", directory);
  }

  function createFolder({ logger }: AstroBuildStartOptions): boolean {
    const folderPath = getFolderPath();

    if (existsSync(folderPath)) {
      return false;
    }

    mkdirSync(folderPath, { recursive: true });

    logger.debug(`Created folder: ${folderPath}`);

    return true;
  }

  function deleteFolder({ logger }: AstroBuildStartOptions): boolean {
    const folderPath = getFolderPath();

    if (!existsSync(folderPath)) {
      return false;
    }

    rmSync(folderPath, { recursive: true, force: true });

    logger.debug(`Deleted folder: ${folderPath}`);

    return true;
  }

  async function downloadAsset(url: string, filename: string): Promise<void> {
    const filePath = resolve(getFolderPath(), filename);

    const writer = createWriteStream(filePath);

    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  }

  return {
    name: "download-sanity-assets",
    hooks: {
      "astro:build:start": async (options) => {
        const { logger } = options;

        logger.debug("Fetching remote assets…");

        const assets = await fetchAssetUrls<D, Q>(query, sanityConfig, options);

        const files = assets
          .map(handler)
          .filter((file) => Boolean(file))
          .map((file) => file!);

        if (!assets.length) {
          logger.debug("No remote assets found.");
          return;
        }

        createdFolder = createFolder(options);

        logger.info(
          `Downloading ${files.length} remote assets to /public/${directory}…`
        );

        for (const { url, filename, sha1hash } of files) {
          if (sha1hash) {
            const isSame = await checkIfFileHasNotChanged(
              resolve(getFolderPath(), filename),
              sha1hash
            );

            if (isSame) {
              logger.info(`Skipping ${filename}, file has not changed.`);
              continue;
            }
          }

          logger.info(`Downloading ${filename}...`);

          await downloadAsset(url, filename).catch((e) => {
            logger.error(`Downloading ${filename} failed.`);
          });
        }
      },
      "astro:build:done": async (options) => {
        if (createdFolder) {
          deleteFolder(options);
        }
      },
    },
  };
}

export default downloadSanityAssets;
