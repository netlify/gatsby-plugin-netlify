import path from "path"

export function buildPrefixer(prefix, ...paths) {
  return (...subpaths) => path.join(prefix, ...paths, ...subpaths)
}

// This function assembles data across the manifests and store to match a similar
// shape of `static-entry.js`. With it, we can build headers that point to the correct
// hashed filenames and ensure we pull in the componentChunkName.
export default function makePluginData(store, assetsManifest, pathPrefix) {
  const { program, pages, components } = store.getState()
  const publicFolder = buildPrefixer(program.directory, `public`)
  const stats = require(publicFolder(`webpack.stats.json`))
  // Get all the files, not just the first
  const chunkManifest = stats.assetsByChunkName

  // We combine the manifest of JS and the manifest of assets to make a lookup table.
  const manifest = { ...assetsManifest, ...chunkManifest }

  return {
    pages,
    components,
    manifest,
    pathPrefix,
    publicFolder,
  }
}
