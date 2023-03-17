// this polyfill adds support for "require('node:<node_builtin>')" imports
// this feature is available in Node v14.18.0+ and v16.0.0+
// gatsby's minimal version (v14.15.0) and `netlify-cli` actual
// minimal version is v14.18.0, so to run tests on gatsby's minimal
// we are adding polyfill to make `netlify-cli` work with gatsby's minimal

// this file is injected with NODE_OPTIONS env var in github actions workflow

try {
  require(`node:path`)
} catch (e) {
  const mod = require("module")
  const originalModuleLoad = mod._load
  mod._load = (request, parent, isMain) => {
    if (request.startsWith(`node:`)) {
      request = request.replace(`node:`, ``)
    }
    return originalModuleLoad(request, parent, isMain)
  }
}
