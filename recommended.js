module.exports = {
  extends: ['./index'],
  
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      // the ts-eslint recommended ruleset sets the parser so we need to set it back
      parser: 'vue-eslint-parser',
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off'
      }
    },
    {
      files: ['shims-tsx.d.ts'],
      rules: {
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/member-delimiter-style': 'off',
        '@typescript-eslint/no-unused-vars': 'off'
      }
    }
  ]
}
