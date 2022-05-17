/* eslint-disable max-lines */
import { parse, posix } from 'path'

import { writeFile, existsSync } from 'fs-extra'
import kebabHash from 'kebab-hash'
import mergeWith from 'lodash.mergewith'

import {
  HEADER_COMMENT,
  IMMUTABLE_CACHING_HEADER,
  COMMON_BUNDLES,
  SECURITY_HEADERS,
  CACHING_HEADERS,
  LINK_REGEX,
  NETLIFY_HEADERS_FILENAME,
  PAGE_DATA_DIR,
} from './constants'
import { isBoolean, flow } from './util'

const getHeaderName = (header: any) => {
  const matches = header.match(/^([^:]+):/)
  return matches && matches[1]
}

const validHeaders = (headers: any, reporter: any) => {
  if (!headers || typeof headers !== 'object') {
    return false
  }

  return Object.entries(headers).every(
    ([path, headersList]) =>
      Array.isArray(headersList) &&
      headersList.every((header) => {
        if (typeof header === 'string' && !getHeaderName(header)) {
          reporter.panic(
            `[gatsby-plugin-netlify] ${path} contains an invalid header (${header}). Please check your plugin configuration`,
          )
        }
        return true
      }),
  )
}

const linkTemplate = (assetPath: any, type = `script`) =>
  `Link: <${assetPath}>; rel=preload; as=${type}${type === `fetch` ? `; crossorigin` : ``}`

const pathChunkName = (path: any) => {
  const name = path === `/` ? `index` : kebabHash(path)
  return `path---${name}`
}

const getPageDataPath = (path: any) => {
  const fixedPagePath = path === `/` ? `index` : path
  return posix.join(`page-data`, fixedPagePath, `page-data.json`)
}

const getScriptPath = (file: any, manifest: any) => {
  const chunk = manifest[file]

  if (!chunk) {
    return []
  }

  // convert to array if it's not already
  const chunks = Array.isArray(chunk) ? chunk : [chunk]

  return chunks.filter((script) => {
    const parsed = parse(script)
    // handle only .js, .css content is inlined already
    // and doesn't need to be pushed
    return parsed.ext === `.js`
  })
}

const getLinkHeaders = (filesByType: any, pathPrefix: any) =>
  Object.entries(filesByType).flatMap(([type, files]: [string, Array<string>]) =>
    files.map((file) => linkTemplate(`${pathPrefix}/${file}`, type)),
  )

const headersPath = (pathPrefix: any, path: any) => `${pathPrefix}${path}`

const preloadHeadersByPage = ({
  pages,
  manifest,
  pathPrefix,
  publicFolder
}: any) => {
  const linksByPage = {}

  const appDataPath = publicFolder(PAGE_DATA_DIR, `app-data.json`)
  const hasAppData = existsSync(appDataPath)

  let hasPageData = false
  if (pages.size !== 0) {
    // test if 1 page-data file exists, if it does we know we're on a gatsby version that supports page-data
    const pageDataPath = publicFolder(getPageDataPath(pages.get(pages.keys().next().value).path))
    hasPageData = existsSync(pageDataPath)
  }

  pages.forEach((page: any) => {
    const scripts = COMMON_BUNDLES.flatMap((file) => getScriptPath(file, manifest))
    scripts.push(
      ...getScriptPath(pathChunkName(page.path), manifest),
      ...getScriptPath(page.componentChunkName, manifest),
    )

    const json = []
    if (hasAppData) {
      json.push(posix.join(PAGE_DATA_DIR, `app-data.json`))
    }

    if (hasPageData) {
      json.push(getPageDataPath(page.path))
    }

    const filesByResourceType = {
      script: scripts.filter(Boolean),
      fetch: json,
    }

    const pathKey = headersPath(pathPrefix, page.path)
    linksByPage[pathKey] = getLinkHeaders(filesByResourceType, pathPrefix)
  })

  return linksByPage
}

const unionMerge = (objValue: any, srcValue: any) => {
  if (Array.isArray(objValue)) {
    return [...new Set([...objValue, ...srcValue])]
  }
  // opt into default merge behavior
}

const defaultMerge = (...headers: any[]) => mergeWith({}, ...headers, unionMerge)

const headersMerge = (userHeaders: any, defaultHeaders: any) => {
  const merged = {}
  Object.keys(defaultHeaders).forEach((path) => {
    if (!userHeaders[path]) {
      merged[path] = defaultHeaders[path]
      return
    }
    const headersMap = {}
    defaultHeaders[path].forEach((header: any) => {
      headersMap[getHeaderName(header)] = header
    })
    userHeaders[path].forEach((header: any) => {
      // override if exists
      headersMap[getHeaderName(header)] = header
    })
    merged[path] = Object.values(headersMap)
  })
  Object.keys(userHeaders).forEach((path) => {
    if (!merged[path]) {
      merged[path] = userHeaders[path]
    }
  })
  return merged
}

const transformLink = (manifest: any, publicFolder: any, pathPrefix: any) => (header: any) => header.replace(LINK_REGEX, (__: any, prefix: any, file: any, suffix: any) => {
  const hashed = manifest[file]
  if (hashed) {
    return `${prefix}${pathPrefix}${hashed}${suffix}`
  }
  if (existsSync(publicFolder(file))) {
    return `${prefix}${pathPrefix}${file}${suffix}`
  }
  throw new Error(
    `Could not find the file specified in the Link header \`${header}\`.` +
      `The gatsby-plugin-netlify is looking for a matching file (with or without a ` +
      `webpack hash). Check the public folder and your gatsby-config.js to ensure you are ` +
      `pointing to a public file.`,
  )
})

// Writes out headers file format, with two spaces for indentation
// https://www.netlify.com/docs/headers-and-basic-auth/
const stringifyHeaders = (headers: any) => Object.entries(headers).reduce((text, [path, headerList]: [string, Array<string>]) => {
  const headersString = headerList.reduce((accum, header) => `${accum}  ${header}\n`, ``)
  return `${text}${path}\n${headersString}`
}, ``)

// program methods

const validateUserOptions = (pluginOptions: any, reporter: any) => (headers: any) => {
  if (!validHeaders(headers, reporter)) {
    throw new Error(
      `The "headers" option to gatsby-plugin-netlify is in the wrong shape. ` +
        `You should pass in a object with string keys (representing the paths) and an array ` +
        `of strings as the value (representing the headers). ` +
        `Check your gatsby-config.js.`,
    )
  }

  [`mergeSecurityHeaders`, `mergeLinkHeaders`, `mergeCachingHeaders`].forEach((mergeOption) => {
    if (!isBoolean(pluginOptions[mergeOption])) {
      throw new TypeError(
        `The "${mergeOption}" option to gatsby-plugin-netlify must be a boolean. Check your gatsby-config.js.`,
      )
    }
  })

  if (typeof pluginOptions.transformHeaders !== 'function') {
    throw new TypeError(
      `The "transformHeaders" option to gatsby-plugin-netlify must be a function ` +
        `that returns an array of header strings. ` +
        `Check your gatsby-config.js.`,
    )
  }

  return headers
}

const mapUserLinkHeaders =
  ({
    manifest,
    pathPrefix,
    publicFolder
  }: any) =>
  (headers: any) => Object.fromEntries(
    Object.entries(headers).map(([path, headerList]: [string, Array<string>]) => [
      path,
      headerList.map(transformLink(manifest, publicFolder, pathPrefix)),
    ]),
  )

const mapUserLinkAllPageHeaders =
  (pluginData: any, {
    allPageHeaders
  }: any) =>
  (headers: any) => {
    if (!allPageHeaders) {
      return headers
    }

    const { pages, manifest, publicFolder, pathPrefix } = pluginData

    const headersList = allPageHeaders.map(transformLink(manifest, publicFolder, pathPrefix))

    const duplicateHeadersByPage = {}
    pages.forEach((page: any) => {
      const pathKey = headersPath(pathPrefix, page.path)
      duplicateHeadersByPage[pathKey] = headersList
    })

    return defaultMerge(headers, duplicateHeadersByPage)
  }

const applyLinkHeaders =
  (pluginData: any, {
    mergeLinkHeaders
  }: any) =>
  (headers: any) => {
    if (!mergeLinkHeaders) {
      return headers
    }

    const { pages, manifest, pathPrefix, publicFolder } = pluginData
    const perPageHeaders = preloadHeadersByPage({
      pages,
      manifest,
      pathPrefix,
      publicFolder,
    })

    return defaultMerge(headers, perPageHeaders)
  }

const applySecurityHeaders =
  ({
    mergeSecurityHeaders
  }: any) =>
  (headers: any) => {
    if (!mergeSecurityHeaders) {
      return headers
    }

    return headersMerge(headers, SECURITY_HEADERS)
  }

const applyCachingHeaders =
  (pluginData: any, {
    mergeCachingHeaders
  }: any) =>
  (headers: any) => {
    if (!mergeCachingHeaders) {
      return headers
    }

    let chunks = []
    // Gatsby v3.5 added componentChunkName to store().components
    // So we prefer to pull chunk names off that as it gets very expensive to loop
    // over large numbers of pages.
    const isComponentChunkSet = Boolean(pluginData.components.entries()?.next()?.value[1]?.componentChunkName)
    chunks = isComponentChunkSet
      ? [...pluginData.components.values()].map((c) => c.componentChunkName)
      : [...pluginData.pages.values()].map((page) => page.componentChunkName)

    chunks.push(`pages-manifest`, `app`)

    const files = chunks.flatMap((chunk) => pluginData.manifest[chunk])

    const cachingHeaders = {}

    files.forEach((file) => {
      if (typeof file === `string`) {
        cachingHeaders[`/${file}`] = [IMMUTABLE_CACHING_HEADER]
      }
    })

    return defaultMerge(headers, cachingHeaders, CACHING_HEADERS)
  }

const applyTransformHeaders =
  ({
    transformHeaders
  }: any) =>
  (headers: any) =>  Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key, transformHeaders(value)])
    )
  

const transformToString = (headers: any) => `${HEADER_COMMENT}\n\n${stringifyHeaders(headers)}`

const writeHeadersFile =
  ({
    publicFolder
  }: any) =>
  (contents: any) => writeFile(publicFolder(NETLIFY_HEADERS_FILENAME), contents)

const buildHeadersProgram = (pluginData: any, pluginOptions: any, reporter: any) =>
  flow(
    [
    validateUserOptions(pluginOptions, reporter),
    mapUserLinkHeaders(pluginData),
    applySecurityHeaders(pluginOptions),
    applyCachingHeaders(pluginData, pluginOptions),
    mapUserLinkAllPageHeaders(pluginData, pluginOptions),
    applyLinkHeaders(pluginData, pluginOptions),
    applyTransformHeaders(pluginOptions),
    transformToString,
    writeHeadersFile(pluginData),
    ])(pluginOptions.headers)

export default buildHeadersProgram
/* eslint-enable max-lines */
