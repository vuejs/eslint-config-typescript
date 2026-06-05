import pluginVue from 'eslint-plugin-vue'
import {
  defineConfigWithVueTs,
  vueTsConfigs,
  configureVueProject,
} from '@vue/eslint-config-typescript'

configureVueProject({
  rootDir: import.meta.dirname,
  scriptLangs: ['ts', 'js'],
  includeDotFolders: true,
})

export default defineConfigWithVueTs(
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked,
)
