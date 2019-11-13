module.exports = {
  root: true,
  env: {
    node: true
  },
  'extends': [
    'plugin:vue/essential',
    'eslint:recommended',
    require.resolve('../../recommended')
  ],
  parserOptions: {
    parser: '@typescript-eslint/parser'
  }
}
