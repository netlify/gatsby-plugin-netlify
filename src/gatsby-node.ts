// https://www.netlify.com/docs/headers-and-basic-auth/

import { promises as fs } from 'fs'
import { join } from 'path'

import { generatePageDataPath } from 'gatsby-core-utils'
import WebpackAssetsManifest from 'webpack-assets-manifest'

import buildHeadersProgram from './build-headers-program'
import { DEFAULT_OPTIONS, BUILD_HTML_STAGE, BUILD_CSS_STAGE, PAGE_COUNT_WARN } from './constants'
import createRedirects from './create-redirects'
import makePluginData from './plugin-data'

const assetsManifest = {}

/** @type {import("gatsby").GatsbyNode["pluginOptionsSchema"]} */
export const pluginOptionsSchema = ({
  Joi
}: any) => {
  const MATCH_ALL_KEYS = /^/

  // headers is a specific type used by Netlify: https://www.gatsbyjs.com/plugins/gatsby-plugin-netlify/#headers
  const headersSchema = Joi.object()
    .pattern(MATCH_ALL_KEYS, Joi.array().items(Joi.string()))
    .description(`Add more Netlify headers to specific pages`)

  return Joi.object({
    headers: headersSchema,
    allPageHeaders: Joi.array().items(Joi.string()).description(`Add more headers to all the pages`),
    mergeSecurityHeaders: Joi.boolean().description(`When set to false, turns off the default security headers`),
    mergeLinkHeaders: Joi.boolean().description(`When set to false, turns off the default gatsby js headers`),
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
/** @type {import("gatsby").GatsbyNode["onCreateWebpackConfig"]} */

export const onCreateWebpackConfig = ({
  actions,
  stage
}: any) => {
  if (stage !== BUILD_HTML_STAGE && stage !== BUILD_CSS_STAGE) {
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

/** @type {import("gatsby").GatsbyNode["onPostBuild"]} */
export const onPostBuild = async ({
  store,
  pathPrefix,
  reporter
}: any, userPluginOptions: any) => {
  const pluginData = makePluginData(store, assetsManifest, pathPrefix)
  const pluginOptions = { ...DEFAULT_OPTIONS, ...userPluginOptions }

  const { redirects, pages, functions = [], program } = store.getState()
  if (pages.size > PAGE_COUNT_WARN && (pluginOptions.mergeCachingHeaders || pluginOptions.mergeLinkHeaders)) {
    reporter.warn(
      `[gatsby-plugin-netlify] Your site has ${pages.size} pages, which means that the generated headers file could become very large. Consider disabling "mergeCachingHeaders" and "mergeLinkHeaders" in your plugin config`,
    )
  }
  reporter.info(`[gatsby-plugin-netlify] Creating SSR/DSG redirects...`)

  let count = 0
  const rewrites: any = []

  let needsFunctions = functions.length !== 0

  ;[...pages.values()].forEach((page) => {
    const { mode, matchPath, path } = page
    if (mode === `SSR` || mode === `DSG`) {
      needsFunctions = true
      const fromPath = matchPath ?? path
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
    }
    if (pluginOptions.generateMatchPathRewrites && matchPath && matchPath !== path) {
      rewrites.push({
        fromPath: matchPath,
        toPath: path,
      })
    }
  })
  reporter.info(`[gatsby-plugin-netlify] Created ${count} SSR/DSG redirect${count === 1 ? `` : `s`}...`)

  if (!needsFunctions) {
    reporter.info(`[gatsby-plugin-netlify] No Netlify functions needed. Skipping...`)
    await fs.writeFile(join(program.directory, `.cache`, `.nf-skip-gatsby-functions`), ``)
  }

  await Promise.all([
    buildHeadersProgram(pluginData, pluginOptions, reporter),
    createRedirects(pluginData, redirects, rewrites),
  ])
}
