import pluginVue from 'eslint-plugin-vue'
import vueTsConfig from '@vue/eslint-config-typescript'

export default [
  ...pluginVue.configs['flat/essential'],
  ...vueTsConfig({ extends: ['recommendedTypeChecked'] }),
]
