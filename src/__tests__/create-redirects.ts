import { readFile } from 'fs-extra'

import createRedirects from '../create-redirects'

import { createPluginData } from './helpers'

jest.mock(`fs-extra`, () => {
  const actualFsExtra = jest.requireActual(`fs-extra`)
  return {
    ...actualFsExtra,
  }
})

const redirects = [
  {
    "fromPath": "/foo",
    "isPermanent": false,
    "ignoreCase": true,
    "redirectInBrowser": false,
    "toPath": "/bar"
  },
  {
    "fromPath": "/blog",
    "isPermanent": false,
    "ignoreCase": true,
    "redirectInBrowser": false,
    "toPath": "/canada/blog",
    "conditions": {
      "country": "ca"
    }
  },
  {
    "fromPath": "/speaker",
    "isPermanent": false,
    "ignoreCase": true,
    "redirectInBrowser": false,
    "toPath": "/english/speaker",
    "conditions": {
      "language": [
        "en"
      ]
    }
  },
  {
    "fromPath": "/speaker",
    "isPermanent": false,
    "ignoreCase": true,
    "redirectInBrowser": false,
    "toPath": "/french/speaker",
    "conditions": {
      "language": [
        "fr"
      ]
    }
  },
  {
    "fromPath": "/param?id=7",
    "isPermanent": false,
    "ignoreCase": true,
    "redirectInBrowser": false,
    "toPath": "/test"
  },
  {
    "fromPath": "/dogs/*",
    "isPermanent": false,
    "ignoreCase": true,
    "redirectInBrowser": false,
    "toPath": "/animals/*"
  },
  {
    "fromPath": "/cats?id=:id",
    "isPermanent": false,
    "ignoreCase": true,
    "redirectInBrowser": false,
    "toPath": "/animals/:id"
  }
]

describe(`create-redirects`, () => {

  it(`writes file`, async () => {
    const pluginData = await createPluginData()

    await createRedirects(pluginData, redirects, [])

    const output = await readFile(pluginData.publicFolder(`_redirects`), `utf8`)
    expect(output).toMatchSnapshot()
  })
})
