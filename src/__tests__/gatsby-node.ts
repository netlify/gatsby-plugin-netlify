/* eslint-disable import/first, max-nested-callbacks */
jest.mock('../plugin-data', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    publicFolder: jest.fn().mockReturnValue('mock-file-path'),
  }),
}))
jest.mock('../build-headers-program', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('fs-extra', () => ({
  __esModule: true,
  default: jest.fn(),
  existsSync: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}))

// Importing writeFile here gives us access to the mocked method to assert the correct content is written to the file within test cases
import { writeFile } from 'fs-extra'
import { testPluginOptionsSchema } from 'gatsby-plugin-utils'

import { pluginOptionsSchema, onPostBuild } from '../gatsby-node'

describe(`gatsby-node.js`, () => {
  describe('testPluginOptionsSchema', () => {
    it(`should provide meaningful errors when fields are invalid`, async () => {
      const expectedErrors = [
        `"headers" must be of type object`,
        `"allPageHeaders" must be an array`,
        `"mergeSecurityHeaders" must be a boolean`,
        `"mergeLinkHeaders" must be a boolean`,
        `"mergeCachingHeaders" must be a boolean`,
        `"transformHeaders" must have an arity lesser or equal to 2`,
        `"generateMatchPathRewrites" must be a boolean`,
      ]

      const { errors } = await testPluginOptionsSchema(pluginOptionsSchema, {
        headers: `this should be an object`,
        allPageHeaders: `this should be an array`,
        mergeSecurityHeaders: `this should be a boolean`,
        mergeLinkHeaders: `this should be a boolean`,
        mergeCachingHeaders: `this should be a boolean`,
        transformHeaders: (too, many, args) => [too, many, args],
        generateMatchPathRewrites: `this should be a boolean`,
      })

      expect(errors).toEqual(expectedErrors)
    })

    it(`should validate the schema`, async () => {
      const { isValid } = await testPluginOptionsSchema(pluginOptionsSchema, {
        headers: {
          '/some-page': [`Bearer: Some-Magic-Token`],
          '/some-other-page': [`some`, `great`, `headers`],
        },
        allPageHeaders: [`First header`, `Second header`],
        mergeSecurityHeaders: true,
        mergeLinkHeaders: false,
        mergeCachingHeaders: true,
        transformHeaders: () => null,
        generateMatchPathRewrites: false,
      })

      expect(isValid).toBe(true)
    })
  })

  describe('onPostBuild', () => {
    let store = {}
    const reporter = {
      info: jest.fn(),
    }
    beforeEach(() => {
      store = {
        getState: jest.fn().mockReturnValue({
          redirects: [],
          pages: [
            {
              mode: 'SSR',
              path: 'some/path',
            },
            {
              mode: 'DSG',
              path: 'some/other/path',
            },
          ],
          functions: [],
          program: { directory: '' },
        }),
      }
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('creates redirects for SSR and DSG pages in format Netlify expects', async () => {
      const expectedValue = [
        '',
        '## Created with gatsby-plugin-netlify',
        'some/path  /.netlify/functions/__ssr  200',
        '/page-data/some/path/page-data.json  /.netlify/functions/__ssr  200',
        'some/other/path  /.netlify/functions/__dsg  200',
        '/page-data/some/other/path/page-data.json  /.netlify/functions/__dsg  200',
      ].join(`\n`)

      await onPostBuild({ store, pathPrefix: '', reporter }, {})
      expect(writeFile).toHaveBeenCalledWith('mock-file-path', expectedValue)
    })
  })
})
/* eslint-enable import/first, max-nested-callbacks */
