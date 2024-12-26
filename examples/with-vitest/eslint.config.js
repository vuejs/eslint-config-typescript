import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import { defineConfig, configs } from '@vue/eslint-config-typescript'

export default defineConfig(
  {
    name: 'app/files-to-lint',
    files: ['**/*.ts', '**/*.mts', '**/*.vue'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  pluginVue.configs['flat/essential'],
  configs.recommended,

  {
    ...pluginVitest.configs['recommended'],
    files: ['src/**/__tests__/*'],
  },
)
