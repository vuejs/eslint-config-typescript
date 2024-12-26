import pluginVue from 'eslint-plugin-vue'
import {
  defineConfig,
  configureVueProject,
  configs,
} from '@vue/eslint-config-typescript'

configureVueProject({
  supportedScriptLangs: {
    js: true,
    jsx: true,
    ts: true,
    tsx: true,
  },
})

export default defineConfig(
  {
    name: 'app/files-to-lint',
    files: [
      '**/*.js',
      '**/*.mjs',
      '**/*.jsx',
      '**/*.ts',
      '**/*.mts',
      '**/*.tsx',
      '**/*.vue',
    ],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  ...pluginVue.configs['flat/essential'],
  configs.recommended,
)
