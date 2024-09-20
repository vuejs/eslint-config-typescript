import * as tseslint from 'typescript-eslint'
import * as tseslintParser from '@typescript-eslint/parser'
import pluginVue from 'eslint-plugin-vue'

type ExtendableConfigName = keyof typeof tseslint.configs
type ScriptLang = 'ts' | 'tsx' | 'js' | 'jsx'
type ConfigOptions = {
  extends?: Array<ExtendableConfigName>
  supportedScriptLangs?: Record<ScriptLang, boolean>
}

type ConfigArray = ReturnType<typeof tseslint.config>

export default function createConfig({
  extends: configNamesToExtend = ['recommended'],
  supportedScriptLangs = { ts: true, tsx: false, js: false, jsx: false },
}: ConfigOptions = {}): ConfigArray {
  const mayHaveJsx = supportedScriptLangs.jsx || supportedScriptLangs.tsx

  return tseslint.config(
    ...configNamesToExtend
      .map(configName => tseslint.configs[configName])
      .flat()
      .map(config =>
        config.files && config.files.includes('**/*.ts')
          ? {
              ...config,
              files: [...config.files, '**/*.vue'],
            }
          : config,
      ),

    // Must set eslint-plugin-vue's base config again no matter whether the user
    // has set it before. Otherwise it would be overriden by the tseslint's config.
    ...pluginVue.configs['flat/base'],

    {
      name: 'vue-typescript/setup',
      files: ['*.vue', '**/*.vue'],
      languageOptions: {
        parserOptions: {
          parser: tseslintParser,
          extraFileExtensions: ['vue'],
          jsx: mayHaveJsx,
          // type-aware linting is in conflict with jsx syntax in `.vue` files
          projectService: !mayHaveJsx,
        },
      },
      rules: {
        'vue/block-lang': [
          'error',
          {
            script: {
              lang: Object.keys(supportedScriptLangs).filter(
                lang => supportedScriptLangs[lang as ScriptLang],
              ),
              allowNoLang: supportedScriptLangs.js,
            },
          },
        ],
      },
    },
  )
}

