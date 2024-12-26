import pluginVue from 'eslint-plugin-vue'
import {
  defineConfig,
  configureVueProject,
  configs,
} from '@vue/eslint-config-typescript'

configureVueProject({ scriptLangs: ['js', 'ts'] })

export default defineConfig(
  {
    name: 'app/files-to-lint',
    files: ['**/*.js', '**/*.mjs', '**/*.ts', '**/*.mts', '**/*.vue'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  pluginVue.configs['flat/essential'],
  configs.recommended,
)
