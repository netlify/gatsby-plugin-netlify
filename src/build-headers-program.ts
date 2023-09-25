/* eslint-disable max-lines */
import { writeFile, existsSync } from 'fs-extra'
import mergeWith from 'lodash.mergewith'

import {
  HEADER_COMMENT,
  IMMUTABLE_CACHING_HEADER,
  SECURITY_HEADERS,
  CACHING_HEADERS,
  LINK_REGEX,
  NETLIFY_HEADERS_FILENAME,
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

const headersPath = (pathPrefix: any, path: any) => `${pathPrefix}${path}`

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

  [`mergeSecurityHeaders`, `mergeCachingHeaders`].forEach((mergeOption) => {
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

    const files = new Set()
    for (const fileNameOrArrayOfFileNames of Object.values(pluginData.manifest)) {
      if (Array.isArray(fileNameOrArrayOfFileNames)) {
        for (const filename of fileNameOrArrayOfFileNames) {
          files.add(filename)
        }
      } else if (typeof fileNameOrArrayOfFileNames === `string`) {
        files.add(fileNameOrArrayOfFileNames)
      }
    }

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
  (headers: any) =>  
    Object.entries(headers).reduce((temp, [key, value]) => {
      temp[key] = transformHeaders(value, key)
      return temp
    }, {})
  

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
    applyTransformHeaders(pluginOptions),
    transformToString,
    writeHeadersFile(pluginData),
    ])(pluginOptions.headers)
  

export default buildHeadersProgram
/* eslint-enable max-lines */
