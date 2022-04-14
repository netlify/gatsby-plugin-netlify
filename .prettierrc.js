const rules = require('@netlify/eslint-config-node/.prettierrc.json')

module.exports = {
  ...rules,
  endOfLine: 'auto',
}
