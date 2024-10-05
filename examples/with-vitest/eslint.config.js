import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
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
    ...pluginVitest.configs['recommended'],
    files: ['src/**/__tests__/*'],
  },
]
