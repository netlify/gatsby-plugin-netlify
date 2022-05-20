import { existsSync, readFile } from 'fs-extra'

import buildHeadersProgram from '../build-headers-program'
import { DEFAULT_OPTIONS } from '../constants'

import { createPluginData } from './helpers'

jest.mock(`fs-extra`, () => {
  const actualFsExtra = jest.requireActual(`fs-extra`)
  return {
    ...actualFsExtra,
    existsSync: jest.fn(),
  }
})
// eslint-disable-next-line max-lines-per-function
describe(`build-headers-program`, () => {
  let reporter: any

  beforeEach(() => {
    reporter = {
      panic: jest.fn(),
    }
    existsSync.mockClear()
    existsSync.mockReturnValue(true)
  })

  it(`with manifest['pages-manifest']`, async () => {
    const pluginData = await createPluginData()

    existsSync.mockImplementation((path: any) => !path.includes(`page-data.json`) && !path.includes(`app-data.json`))

    // gatsby < 2.9 uses page-manifest
    pluginData.manifest[`pages-manifest`] = [`pages-manifest-ab11f09e0ca7ecd3b43e.js`]

    const pluginOptions = {
      ...DEFAULT_OPTIONS,
      mergeCachingHeaders: true,
    }

    await buildHeadersProgram(pluginData, pluginOptions, reporter)

    expect(reporter.panic).not.toHaveBeenCalled()
    const output = await readFile(pluginData.publicFolder(`_headers`), `utf8`)
    expect(output).toMatchSnapshot()
    expect(output).toMatch(/\/pages-manifest-ab11f09e0ca7ecd3b43e\.js/g)
    expect(output).not.toMatch(/\/undefined/g)
  })

  it(`without app-data file`, async () => {
    const pluginData = await createPluginData()

    // gatsby 2.17.0+ adds an app-data file
    delete pluginData.manifest[`pages-manifest`]

    const pluginOptions = {
      ...DEFAULT_OPTIONS,
      mergeCachingHeaders: true,
    }
    existsSync.mockImplementation((path: any) => !path.includes(`app-data.json`))

    await buildHeadersProgram(pluginData, pluginOptions, reporter)

    expect(reporter.panic).not.toHaveBeenCalled()
    const output = await readFile(pluginData.publicFolder(`_headers`), `utf8`)
    expect(output).not.toMatch(/app-data\.json/g)
    expect(output).not.toMatch(/\/undefined/g)
  })

  it(`without caching headers`, async () => {
    const pluginData = await createPluginData()

    const pluginOptions = {
      ...DEFAULT_OPTIONS,
      mergeCachingHeaders: false,
    }

    await buildHeadersProgram(pluginData, pluginOptions, reporter)

    expect(reporter.panic).not.toHaveBeenCalled()
    expect(await readFile(pluginData.publicFolder(`_headers`), `utf8`)).toMatchSnapshot()
  })

  it(`with security headers`, async () => {
    const pluginData = await createPluginData()

    const pluginOptions = {
      ...DEFAULT_OPTIONS,
      mergeSecurityHeaders: true,
      headers: {
        '/*': [
          `Content-Security-Policy: frame-ancestors 'self' https://*.storyblok.com/`,
          `X-Frame-Options: ALLOW-FROM https://app.storyblok.com/`,
        ],
        '/hello': [`X-Frame-Options: SAMEORIGIN`],
      },
    }

    await buildHeadersProgram(pluginData, pluginOptions, reporter)

    expect(reporter.panic).not.toHaveBeenCalled()
    expect(await readFile(pluginData.publicFolder(`_headers`), `utf8`)).toMatchSnapshot()
  })

  it(`with badly headers configuration`, async () => {
    const pluginData = await createPluginData()

    const pluginOptions = {
      ...DEFAULT_OPTIONS,
      mergeSecurityHeaders: true,
      headers: {
        'X-Frame-Options': [`sameorigin`],
      },
    }

    await buildHeadersProgram(pluginData, pluginOptions, reporter)

    expect(reporter.panic).toHaveBeenCalled()
  })
})
