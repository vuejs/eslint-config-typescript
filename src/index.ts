import * as tseslint from 'typescript-eslint'
import * as tseslintParser from '@typescript-eslint/parser'

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
      .flat(),

    {
      files: ['*.vue', '**/*.vue'],
      languageOptions: {
        parserOptions: {
          parser: tseslintParser,
          extraFileExtensions: ['vue'],
          jsx: mayHaveJsx,
          // type-aware linting is in conflict with jsx syntax in `.vue` files
          projectService: !mayHaveJsx
        }
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
