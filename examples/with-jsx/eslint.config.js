import pluginVue from 'eslint-plugin-vue'
import { defineConfig, configs } from '@vue/eslint-config-typescript'

export default defineConfig(
  {
    name: 'app/files-to-lint',
    files: ['**/*.js', '**/*.mjs', '**/*.jsx', '**/*.ts', '**/*.mts', '**/*.tsx', '**/*.vue'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  pluginVue.configs['flat/essential'],
  configs.recommended,
)
