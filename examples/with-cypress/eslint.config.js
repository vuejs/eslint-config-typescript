import pluginVue from 'eslint-plugin-vue'
import pluginCypress from 'eslint-plugin-cypress/flat'
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
    files: [
      '**/__tests__/*.{cy,spec}.{js,ts,jsx,tsx}',
      'cypress/e2e/**/*.{cy,spec}.{js,ts,jsx,tsx}',
      'cypress/support/**/*.{js,ts,jsx,tsx}'
    ],
    ...pluginCypress.configs.recommended,
  }
]
