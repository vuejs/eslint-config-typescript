import pluginVue from 'eslint-plugin-vue'
import {
  defineConfig,
  configureVueProject,
  configs,
} from '@vue/eslint-config-typescript'

configureVueProject({
  supportedScriptLangs: {
    ts: true,
    tsx: true,
  }
})

export default defineConfig(
  {
    name: 'app/files-to-lint',
    files: ['**/*.ts', '**/*.mts', '**/*.tsx', '**/*.vue'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  ...pluginVue.configs['flat/essential'],
  configs.recommended,
)
