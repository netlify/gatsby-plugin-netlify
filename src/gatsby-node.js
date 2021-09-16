// https://www.netlify.com/docs/headers-and-basic-auth/

import WebpackAssetsManifest from "webpack-assets-manifest"
import { generatePageDataPath } from "gatsby-core-utils"
import makePluginData from "./plugin-data"
import buildHeadersProgram from "./build-headers-program"
import createRedirects from "./create-redirects"
import { DEFAULT_OPTIONS, BUILD_HTML_STAGE, BUILD_CSS_STAGE } from "./constants"

const assetsManifest = {}

// Inject a webpack plugin to get the file manifests so we can translate all link headers
exports.onCreateWebpackConfig = ({ actions, stage }) => {
  if (stage !== BUILD_HTML_STAGE && stage !== BUILD_CSS_STAGE) {
    return
  }
  actions.setWebpackConfig({
    plugins: [
      new WebpackAssetsManifest({
        assets: assetsManifest, // mutates object with entries
        merge: true,
      }),
    ],
  })
}

exports.onPostBuild = async (
  { store, pathPrefix, reporter },
  userPluginOptions
) => {
  const pluginData = makePluginData(store, assetsManifest, pathPrefix)
  const pluginOptions = { ...DEFAULT_OPTIONS, ...userPluginOptions }

  const { redirects, pages } = store.getState()
  reporter.info(`[gatsby-plugin-netlify] Creating SSR redirects...`)
  let count = 0
  const rewrites = []
  Array.from(pages.values()).forEach(page => {
    const { mode, matchPath, path } = page
    if (mode === `SSR`) {
      count++
      rewrites.push(
        {
          fromPath: matchPath ?? path,
          toPath: `/.netlify/functions/__ssr`,
        },
        {
          fromPath: generatePageDataPath(`/`, matchPath ?? path),
          toPath: `/.netlify/functions/__ssr`,
        }
      )
    }
    if (
      pluginOptions.generateMatchPathRewrites &&
      page.matchPath !== page.path
    ) {
      rewrites.push({
        fromPath: page.matchPath,
        toPath: page.path,
      })
    }
  })
  reporter.info(
    `[gatsby-plugin-netlify] Created ${count} SSR redirect${
      count === 1 ? `` : `s`
    }...`
  )

  await Promise.all([
    buildHeadersProgram(pluginData, pluginOptions, reporter),
    createRedirects(pluginData, redirects, rewrites),
  ])
}

const MATCH_ALL_KEYS = /^/
const pluginOptionsSchema = function ({ Joi }) {
  // headers is a specific type used by Netlify: https://www.gatsbyjs.com/plugins/gatsby-plugin-netlify/#headers
  const headersSchema = Joi.object()
    .pattern(MATCH_ALL_KEYS, Joi.array().items(Joi.string()))
    .description(`Add more Netlify headers to specific pages`)

  return Joi.object({
    headers: headersSchema,
    allPageHeaders: Joi.array()
      .items(Joi.string())
      .description(`Add more headers to all the pages`),
    mergeSecurityHeaders: Joi.boolean().description(
      `When set to true, turns off the default security headers`
    ),
    mergeLinkHeaders: Joi.boolean().description(
      `When set to true, turns off the default gatsby js headers`
    ),
    mergeCachingHeaders: Joi.boolean().description(
      `When set to true, turns off the default caching headers`
    ),
    transformHeaders: Joi.function()
      .maxArity(2)
      .description(
        `Transform function for manipulating headers under each path (e.g.sorting), etc. This should return an object of type: { key: Array<string> }`
      ),
    generateMatchPathRewrites: Joi.boolean().description(
      `When set to true, turns off automatic creation of redirect rules for client only paths`
    ),
  })
}

exports.pluginOptionsSchema = pluginOptionsSchema
