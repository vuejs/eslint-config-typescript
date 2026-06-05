import pluginVue from 'eslint-plugin-vue'
import {
  defineConfigWithVueTs,
  vueTsConfigs,
  configureVueProject,
} from '@vue/eslint-config-typescript'

const projectOptions: {
  rootDir: string
  scriptLangs: ['ts', 'js']
} = {
  rootDir: import.meta.dirname,
  scriptLangs: ['ts', 'js'],
}

configureVueProject(projectOptions)

const config = defineConfigWithVueTs(
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
)

export default config
