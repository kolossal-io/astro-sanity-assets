# astro-sanity-assets 📥

This **[Astro integration][astro-integration]** downloads Sanity File Assets to your project's `public/` directory on build which makes these files available in your `dist/` directory without the Sanity CDN.

## Installation

First, install the package using your package manager, for example:

```sh
npm install astro-sanity-assets
```

Then, apply the integration to your Astro config file using the integrations property:

```js
import { defineConfig } from "astro/config";
import downloadSanityAssets from "astro-sanity-assets";

export default defineConfig({
  // ...
  integrations: [
    downloadSanityAssets({
      // see Configuration section below
    }),
  ],
});
```

## Configuration

The configuration expects a Sanity client config as used for [`@sanity/client`](sanity-client) as well as the [GROQ](groq) `query` to retrieve your files from Sanity and a `directory` name to use for your files inside the `public/` folder.

```js
import { defineConfig } from "astro/config";
import downloadSanityAssets from "astro-sanity-assets";

export default defineConfig({
  // ...
  integrations: [
    downloadSanityAssets({
      projectId: "<YOUR-PROJECT-ID>",
      dataset: "<YOUR-DATASET-NAME>",
      query: `*[_type == "download"].file.asset->`,
      directory: "directory",
    }),
  ],
});
```

### `directory`

The plugin run on every Astro build, retrieve the list of files and will download them to `public/<directory>`. So in the example above all attachments from the `file` field in `download` documents will be downloaded to `public/downloads` and therefore land in the final `dist/downloads` folder.

If the specified `directory` does not exist in the `public/` folder, the plugin will create the folder and delete it after the build, so that only the `dist/` folder will contain the files after the build is done. The folder will not be deleted, if it already existed when the build was started.

### `query`

Any [GROQ query](groq) that will return an array of Sanity [Asset](sanity-asset) objects as returned by the [File](sanity-file) field. The only required fields are `assetId`, `extension` and `url`. You may also use a totally different query and tweak the data by using the [`handler`](#handler) function.

The files by default will be named `<assetId>.<extension>`.

### `handler`

Sometimes you may want to use a `query` that does not return Sanity [Assets](sanity-asset) and therefore have to tweak the query result a bit. For example:

```ts
import { defineConfig } from "astro/config";
import downloadSanityAssets from "astro-sanity-assets";

type FileAssetType = {
  url: string;
  originalFilename: string;
};

export default defineConfig({
  // ...
  integrations: [
    downloadSanityAssets<FileAssetType>({
      projectId: "<YOUR-PROJECT-ID>",
      dataset: "<YOUR-DATASET-NAME>",
      query: `*[_type == "fileType" && mimeType == "video/mp4"]`,
      directory: "videos",
      handler: (file) =>
        file.url && file.originalFilename
          ? {
              url: file.url, // URL of the file to download
              filename: file.originalFilename, // local filename
            }
          : undefined,
    }),
  ],
});
```

The `handler` function receives every item from the array returned by the [`query`](#query) and must return an object containing the `url` to download and the local `filename` to use inside the [`directory`](#directory).

## License

<p>
    <br />
    <a href="https://kolossal.io" target="_blank">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/kolossal-io/laravel-multiplex/HEAD/.github/kolossal-logo-dark.svg">
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/kolossal-io/laravel-multiplex/HEAD/.github/kolossal-logo-light.svg">
        <img alt="Multiplex" src="https://raw.githubusercontent.com/kolossal-io/laravel-multiplex/HEAD/.github/kolossal-log-light.svg" width="138" height="32" style="max-width: 100%;">
    </picture>
    </a>
    <br />
    <br />
</p>

Copyright © [kolossal](https://kolossal.io). Released under [MIT License](LICENSE.md).


[astro-integration]: https://docs.astro.build/en/guides/integrations-guide/
[sanity-client]: https://github.com/sanity-io/client
[sanity-file]: https://www.sanity.io/docs/file-type
[sanity-asset]: https://www.sanity.io/docs/assets
[groq]: https://www.sanity.io/docs/groq
