import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.ts', '**/*.mts', '**/*.vue'],
    ignores: ['**/dist/**'],
  },

  ...pluginVue.configs['flat/essential'],
  ...vueTsEslintConfig(),

  {
    files: ['tests/e2e/**/*.{js,ts}', '**/__tests__/**/*.{js,ts}'],
    rules: {
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      // You can use https://github.com/ihordiachenko/eslint-plugin-chai-friendly for more accurate linting
    },
  },
]
