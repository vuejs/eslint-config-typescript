import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.ts', '**/*.mts', '**/*.vue'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    // nightwatch specs
    files: ['tests/e2e/**/*.{js,ts}', '**/__tests__/**/*.{js,ts}'],
    rules: {
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      // You can use https://github.com/ihordiachenko/eslint-plugin-chai-friendly for more accurate linting
    },
  },
)
