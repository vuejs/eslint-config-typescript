import { globalIgnores } from 'eslint/config'
import pluginVue from 'eslint-plugin-vue'
import { withVueTs, vueTsConfigs } from '../../../dist/index.mjs'

export default withVueTs(
  {
    rootDir: import.meta.dirname,
  },

  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/coverage/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked,
)
