import _ from "lodash"

// Gatsby values
export const BUILD_HTML_STAGE = `build-html`
export const BUILD_CSS_STAGE = `build-css`

// Plugin values
export const NETLIFY_HEADERS_FILENAME = `_headers`

export const DEFAULT_OPTIONS = {
  headers: {},
  mergeSecurityHeaders: true,
  mergeLinkHeaders: true,
  mergeCachingHeaders: true,
  transformHeaders: _.identity, // optional transform for manipulating headers for sorting, etc
  generateMatchPathRewrites: true, // generate rewrites for client only paths
}

export const SECURITY_HEADERS = {
  "/*": [
    `X-Frame-Options: DENY`,
    `X-XSS-Protection: 1; mode=block`,
    `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: same-origin`,
  ],
}

export const IMMUTABLE_CACHING_HEADER = `Cache-Control: public, max-age=31536000, immutable`

export const CACHING_HEADERS = {
  "/static/*": [IMMUTABLE_CACHING_HEADER],
  "/sw.js": [`Cache-Control: no-cache`],
}

export const LINK_REGEX = /^(Link: <\/)(.+)(>;.+)/
export const ROOT_WILDCARD = `/*`

export const COMMON_BUNDLES = [`commons`, `app`]

export const HEADER_COMMENT = `## Created with gatsby-plugin-netlify`

export const PAGE_DATA_DIR = `page-data/`

export const PAGE_COUNT_WARN = 1000
