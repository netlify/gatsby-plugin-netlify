import { testPluginOptionsSchema } from "gatsby-plugin-utils"

import { pluginOptionsSchema } from "../gatsby-node"

// @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
describe(`gatsby-node.js`, () => {
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
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
      transformHeaders: (too: any, many: any, args: any) => ``,
      generateMatchPathRewrites: `this should be a boolean`,
    })

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(errors).toEqual(expectedErrors)
  })

  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
  it(`should validate the schema`, async () => {
    const { isValid } = await testPluginOptionsSchema(pluginOptionsSchema, {
      headers: {
        "/some-page": [`Bearer: Some-Magic-Token`],
        "/some-other-page": [`some`, `great`, `headers`],
      },
      allPageHeaders: [`First header`, `Second header`],
      mergeSecurityHeaders: true,
      mergeLinkHeaders: false,
      mergeCachingHeaders: true,
      transformHeaders: () => null,
      generateMatchPathRewrites: false,
    })

    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'expect'.
    expect(isValid).toBe(true)
  })
})
