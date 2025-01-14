import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked,

  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.vue'],
    rules: {
      // With plain ESLint configs, the following rule will throw
      // because some of the vue files can't be type-checked.
      // But now it's handled by `defineConfigWithVueTs`.
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    }
  },
)
