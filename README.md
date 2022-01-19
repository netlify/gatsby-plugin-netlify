# gatsby-plugin-netlify

This plugin adds support for Gatsby SSR and DSG on Netlify, and handles Gatsby redirects and headers.

The plugin works by automatically generating a `_headers` and `_redirects` file at the root of the public folder to
configure [HTTP headers](https://www.netlify.com/docs/headers-and-basic-auth/) and
[redirects](https://www.netlify.com/docs/redirects/) on Netlify.

By default, the plugin will add some basic security headers. You can easily add or replace headers through the plugin
config.

**When not to use the plugin:** In case you just want to use your own `_redirects` or `_headers` file for Netlify with
Gatsby, you don't need this plugin. Instead, move those files in `/static/_redirects`, `/static/_headers` and Gatsby
will copy them to your root folder during build where Netlify will pick them up. Note that this plugin is still required
if you want to use SSR or DSG rendering.

## Install

`npm install gatsby-plugin-netlify`

## How to use

```javascript
// In your gatsby-config.js
plugins: [`gatsby-plugin-netlify`]
```

## Configuration

If you just need the critical assets, you don't need to add any additional config. However, if you want to add headers,
remove default headers, or transform the given headers, you can use the following configuration options.

```javascript
plugins: [
  {
    resolve: `gatsby-plugin-netlify`,
    options: {
      headers: {}, // option to add more headers. `Link` headers are transformed by the below criteria
      allPageHeaders: [], // option to add headers for all pages. `Link` headers are transformed by the below criteria
      mergeSecurityHeaders: true, // boolean to turn off the default security headers
      mergeLinkHeaders: true, // boolean to turn off the default gatsby js headers
      mergeCachingHeaders: true, // boolean to turn off the default caching headers
      transformHeaders: (headers, path) => headers, // optional transform for manipulating headers under each path (e.g.sorting), etc.
      generateMatchPathRewrites: true, // boolean to turn off automatic creation of redirect rules for client only paths
    },
  },
]
```

### Headers

The headers object represents a JS version of the
[Netlify `_headers` file format](https://www.netlify.com/docs/headers-and-basic-auth/). You should pass in an object
with string keys (representing the paths) and an array of strings for each header.

An example:

```javascript
{
  options: {
    headers: {
      "/*": [
        "Basic-Auth: someuser:somepassword anotheruser:anotherpassword",
      ],
      "/my-page": [
        // matching headers (by type) are replaced by Netlify with more specific routes
        "Basic-Auth: differentuser:differentpassword",
      ],
    },
  }
}
```

Link paths are specially handled by this plugin. Since most files are processed and cache-busted through Gatsby (with a
file hash), the plugin will transform any base file names to the hashed variants. If the file is not hashed, it will
ensure the path is valid relative to the output `public` folder. You should be able to reference assets imported through
javascript in the `static` folder.

When `mergeLinkHeaders` is true, as it is by default, this plugin will generate HTTP preload headers for the asset paths
for all of your application's pages.

An example:

```
/my-page
  Link: </webpack-runtime-61d3e010ac286a1ce7e1.js>; rel=preload; as=script
  Link: </styles-89fd2ae28bdf06750a71.js>; rel=preload; as=script
  Link: </framework-376edee25eb5f5cd8260.js>; rel=preload; as=script
  Link: </app-9035e07a2b55474b8eee.js>; rel=preload; as=script
  Link: </styles-89fd2ae28bdf06750a71.js>; rel=preload; as=script
  Link: </component---src-pages-index-js-102db70fdea806a1e5b8.js>; rel=preload; as=script
  Link: </page-data/app-data.json>; rel=preload; as=fetch; crossorigin
  Link: </page-data/index/page-data.json>; rel=preload; as=fetch; crossorigin
```

Therefore, expect the size of the `_headers` file to grow linearly with the number of pages in your application.

> **Note:** Gatsby also adds these preload tags in your pages' index.html files, whether or not you are using this
> plugin.

Do not specify the public path in the config, as the plugin will provide it for you.

The Netlify `_headers` file does not inherit headers, and it will replace any matching headers it finds in more specific
routes. For example, if you add a link to the root wildcard path (`/*`), it will be replaced by any more specific path.
If you want a resource to put linked across the site, you will have to add to every path. To make this easier, the
plugin provides the `allPageHeaders` option to inject the same headers on every path.

```javascript
{
  options: {
    allPageHeaders: [
      "Link: </static/my-logo.png>; rel=preload; as=image",
    ],
    headers: {
      "/*": [
        "Basic-Auth: someuser:somepassword anotheruser:anotherpassword",
      ],
    },
  }
}
```

You can validate the `_headers` config through the [Netlify playground app](https://play.netlify.com/headers).

### Redirects

You can create redirects using the [`createRedirect`](https://www.gatsbyjs.org/docs/actions/#createRedirect) action.

In addition to the options provided by the Gatsby API, you can pass these options specific to this plugin:

| Attribute    | Description                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `force`      | Overrides existing content in the path. This is particularly useful for domain alias redirects. See [the Netlify documentation for this option](https://www.netlify.com/docs/redirects/#structured-configuration).                                                                                                                                                                                               |
| `statusCode` | Overrides the HTTP status code which is set to `302` by default or `301` when [`isPermanent`](https://www.gatsbyjs.org/docs/actions/#createRedirect) is `true`. Since Netlify supports custom status codes, you can set one here. For example, `200` for rewrites, or `404` for a custom error page. See [the Netlify documentation for this option](https://www.netlify.com/docs/redirects/#http-status-codes). |

An example:

```javascript
createRedirect({ fromPath: '/old-url', toPath: '/new-url', isPermanent: true })
createRedirect({ fromPath: '/url', toPath: '/zn-CH/url', Language: 'zn' })
createRedirect({
  fromPath: '/url_that_is/not_pretty',
  toPath: '/pretty/url',
  statusCode: 200,
})
```

You can also create a `_redirects` file in the `static` folder for the same effect. Any programmatically created
redirects will be appended to the file.

```shell
# my manually set redirects
/home              /
/blog/my-post.php  /blog/my-post
```

You can validate the `_redirects` config through the [Netlify playground app](https://play.netlify.com/redirects).

Redirect rules are automatically added for
[client only paths](https://www.gatsbyjs.org/docs/client-only-routes-and-user-authentication). The plugin uses the
[matchPath](https://www.gatsbyjs.org/docs/gatsby-internals-terminology/#matchpath) syntax to match all possible requests
in the range of your client-side routes and serves the HTML file for the client-side route. Without it, only the exact
route of the client-side route works.

If those rules are conflicting with custom rules or if you want to have more control over them you can disable them in
[configuration](#configuration) by setting `generateMatchPathRewrites` to `false`.
