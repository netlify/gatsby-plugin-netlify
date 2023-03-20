// https://www.netlify.com/docs/headers-and-basic-auth/
import { join } from 'path'

import { writeJson, remove } from 'fs-extra'
import type { GatsbyNode } from 'gatsby'
import { generatePageDataPath } from 'gatsby-core-utils'
import WebpackAssetsManifest from 'webpack-assets-manifest'

import buildHeadersProgram from './build-headers-program'
import { DEFAULT_OPTIONS, BUILD_BROWSER_BUNDLE_STAGE, PAGE_COUNT_WARN } from './constants'
import createRedirects from './create-redirects'
import makePluginData from './plugin-data'

const assetsManifest: Record<string, unknown> = {}

export const pluginOptionsSchema: GatsbyNode["pluginOptionsSchema"] = ({ Joi }) => {
  const MATCH_ALL_KEYS = /^/

  // headers is a specific type used by Netlify: https://www.gatsbyjs.com/plugins/gatsby-plugin-netlify/#headers
  const headersSchema = Joi.object()
    .pattern(MATCH_ALL_KEYS, Joi.array().items(Joi.string()))
    .description(`Add more Netlify headers to specific pages`)

  return Joi.object({
    headers: headersSchema,
    allPageHeaders: Joi.array().items(Joi.string()).description(`Add more headers to all the pages`),
    mergeSecurityHeaders: Joi.boolean().description(`When set to false, turns off the default security headers`),
    mergeLinkHeaders: Joi.boolean().description(`When set to false, turns off the default gatsby js headers`).forbidden().messages({
      "any.unknown": `"mergeLinkHeaders" is no longer supported. Gatsby no longer adds preload headers as they negatively affect load performance`
    }),
    mergeCachingHeaders: Joi.boolean().description(`When set to false, turns off the default caching headers`),
    transformHeaders: Joi.function()
      .maxArity(2)
      .description(
        `Transform function for manipulating headers under each path (e.g.sorting), etc. This should return an object of type: { key: Array<string> }`,
      ),
    generateMatchPathRewrites: Joi.boolean().description(
      `When set to false, turns off automatic creation of redirect rules for client only paths`,
    ),
  })
}

// Inject a webpack plugin to get the file manifests so we can translate all link headers
export const onCreateWebpackConfig: GatsbyNode["onCreateWebpackConfig"] = ({ actions, stage }) => {
  // We only need to get manifest for production browser bundle
  if (stage !== BUILD_BROWSER_BUNDLE_STAGE) {
    return
  }
  actions.setWebpackConfig({
    plugins: [
      new WebpackAssetsManifest({
        // mutates object with entries
        assets: assetsManifest,
        merge: true,
      }),
    ],
  })
}

export const onPostBuild: GatsbyNode["onPostBuild"] = async ({ store, pathPrefix, reporter }, userPluginOptions) => {
  const pluginData = makePluginData(store, assetsManifest, pathPrefix)
  const pluginOptions = { ...DEFAULT_OPTIONS, ...userPluginOptions }

  const { redirects, pages, functions = [], program } = store.getState()
  if (pages.size > PAGE_COUNT_WARN && pluginOptions.mergeCachingHeaders ) {
    reporter.warn(
      `[gatsby-plugin-netlify] Your site has ${pages.size} pages, which means that the generated headers file could become very large. Consider disabling "mergeCachingHeaders" in your plugin config`,
    )
  }
  reporter.info(`[gatsby-plugin-netlify] Creating SSR/DSG redirects...`)

  let count = 0
  const rewrites: any = []

  const neededFunctions = {
    API: functions.length !== 0,
    SSR: false,
    DSG: false,
  }

  ;[...pages.values()].forEach((page) => {
    const { mode, matchPath, path } = page
    const matchPathClean = matchPath && matchPath.replace(/\*.*/, '*')
    const matchPathIsNotPath = matchPath && matchPath !== path

    if (mode === `SSR` || mode === `DSG`) {
      neededFunctions[mode] = true
      const fromPath = matchPathClean ?? path
      const toPath = mode === `SSR` ? `/.netlify/functions/__ssr` : `/.netlify/functions/__dsg`
      count++
      rewrites.push(
        {
          fromPath,
          toPath,
        },
        {
          fromPath: generatePageDataPath(`/`, fromPath),
          toPath,
        },
      )
    } else if (pluginOptions.generateMatchPathRewrites && matchPathIsNotPath) {
      rewrites.push({
        fromPath: matchPathClean,
        toPath: path,
      })
    }
  })
  reporter.info(`[gatsby-plugin-netlify] Created ${count} SSR/DSG redirect${count === 1 ? `` : `s`}...`)

  const skipFilePath = join(program.directory, `.cache`, `.nf-skip-gatsby-functions`)
  const generateSkipFile = Object.values(neededFunctions).includes(false)
    ? writeJson(skipFilePath, neededFunctions)
    : remove(skipFilePath)

  await Promise.all([
    generateSkipFile,
    buildHeadersProgram(pluginData, pluginOptions, reporter),
    createRedirects(pluginData, redirects, rewrites),
  ])
}
