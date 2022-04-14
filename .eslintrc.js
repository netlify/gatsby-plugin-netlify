module.exports = {
  extends: '@netlify/eslint-config-node',
  rules: {
    'max-depth': 0,
    complexity: 0,
    'fp/no-let': 0,
    'fp/no-loops': 0,
    'fp/no-mutation': 0,
    'fp/no-mutating-methods': 0,
    'id-length': 0,
    'no-magic-numbers': 0,
    'no-param-reassign': 0,
    'no-promise-executor-return': 0,
    'no-prototype-builtins': 0,
    'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    'unicorn/filename-case': 0,
    'unicorn/numeric-separators-style': 0,
    'unicorn/no-empty-file': 0,
    'no-plusplus': 0,
  },
  parserOptions: {
    sourceType: 'module',
  },
  env: {
    jest: true,
  },
  overrides: [
    {
      // Tests use lots of nested callbacks
      files: ['**/__tests__/*.ts'],
      rules: {
        'max-nested-callbacks': 'off',
        'import/first': 'off',
      },
    },
  ],
}
