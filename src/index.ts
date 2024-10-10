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
  const mayHaveJsxInSfc = supportedScriptLangs.jsx || supportedScriptLangs.tsx
  const needsTypeAwareLinting = configNamesToExtend.some(name =>
    name.includes('TypeChecked') && name !== 'disableTypeChecked',
  )

  // Type-aware linting is in conflict with JSX syntax in `.vue` files
  // [!NOTE TO MYSELF] There's room for improvement here.
  // We could disable type-aware linting *only* for `.vue` files with JSX syntax.
  // Then the following error can be changed to a warning.
  if (needsTypeAwareLinting && mayHaveJsxInSfc) {
    throw new Error(
      'Type-aware linting is not supported in Vue SFCs with JSX syntax. ' +
        'Please disable type-aware linting or set `supportedScriptLangs.jsx` ' +
        'and `supportedScriptLangs.tsx` to `false`.',
    )
  }

  const noProjectServiceForVue = mayHaveJsxInSfc
  const projectServiceConfigs: ConfigArray = []

  if (noProjectServiceForVue) {
    projectServiceConfigs.push({
      name: 'vue-typescript/project-service-for-vue',
      files: ['*.vue', '**/*.vue'],
      languageOptions: {
        parserOptions: {
          projectService: false,
        },
      },
    })
  }

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
    // has set it before. Otherwise it would be overridden by the tseslint's config.
    ...pluginVue.configs['flat/base'],

    {
      name: 'vue-typescript/setup',
      files: ['*.vue', '**/*.vue'],
      languageOptions: {
        parserOptions: {
          parser: {
            // Fallback to espree for js/jsx scripts, as well as SFCs without scripts
            // for better performance.
            js: 'espree',
            jsx: 'espree',

            ts: tseslintParser,
            tsx: tseslintParser,

            // Leave the template parser unspecified,
            // so that it could be determined by `<script lang="...">`
          },
          ecmaFeatures: {
            jsx: mayHaveJsxInSfc,
          },
          extraFileExtensions: ['vue'],
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

    ...projectServiceConfigs,
  )
}
