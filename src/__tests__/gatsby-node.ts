/* eslint-disable max-lines-per-function */
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
  writeJson: jest.fn(),
  remove: jest.fn(),
}))

// Importing writeFile here gives us access to the mocked method to assert the correct content is written to the file within test cases
import { writeFile, writeJson, remove } from 'fs-extra'
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
    const reporter = {
      info: jest.fn(),
    }

    it('creates redirects for SSR and DSG pages in format Netlify expects', async () => {
      const store = {
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
      const expectedValue = [
        '',
        '## Created with gatsby-plugin-netlify',
        'some/path  /.netlify/functions/__ssr  200',
        '/page-data/some/path/page-data.json  /.netlify/functions/__ssr  200',
        'some/other/path  /.netlify/functions/__dsg  200',
        '/page-data/some/other/path/page-data.json  /.netlify/functions/__dsg  200',
      ].join(`\n`)

      await onPostBuild({ store, pathPrefix: '', reporter }, {})
      expect(writeFile).toHaveBeenLastCalledWith('mock-file-path', expectedValue)
    })

    it('creates skip file for unneeded function bundles', async () => {
      const store = {
        getState: jest.fn().mockReturnValue({
          redirects: [],
          pages: [
            {
              mode: 'DSG',
              path: 'some/other/path',
            },
          ],
          functions: [],
          program: { directory: '' },
        }),
      }
      const expectedValue = {
        API: false,
        SSR: false,
        DSG: true,
      }

      await onPostBuild({ store, pathPrefix: '', reporter }, {})
      expect(writeJson).toHaveBeenLastCalledWith('.cache/.nf-skip-gatsby-functions', expectedValue)
    })

    it('removes skip file when all function bundles needed', async () => {
      const store = {
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
          functions: [true],
          program: { directory: '' },
        }),
      }

      await onPostBuild({ store, pathPrefix: '', reporter }, {})
      expect(remove).toHaveBeenCalled()
    })
  })
})
/* eslint-enable max-lines-per-function */
