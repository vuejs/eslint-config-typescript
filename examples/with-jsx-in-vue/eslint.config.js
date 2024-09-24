import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.js', '**/*.mjs', '**/*.jsx', '**/*.ts', '**/*.mts', '**/*.tsx', '**/*.vue'],
    ignores: ['**/dist/**'],
  },

  ...pluginVue.configs['flat/essential'],
  ...vueTsEslintConfig({
    supportedScriptLangs: {
      ts: true,
      tsx: true,
      js: true,
      jsx: true
    }
  }),
]
