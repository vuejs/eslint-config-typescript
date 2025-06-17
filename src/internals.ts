import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import pluginVue from 'eslint-plugin-vue'
import type { Parser } from '@typescript-eslint/utils/ts-eslint'

export type ScriptLang = 'ts' | 'tsx' | 'js' | 'jsx'

type ConfigArray = ReturnType<typeof tseslint.config>

// https://typescript-eslint.io/troubleshooting/typed-linting/performance#changes-to-extrafileextensions-with-projectservice
const extraFileExtensions = ['.vue']

// Note that ESLint uses minimatch while we use fast-glob (which uses micromatch underlyingly). They differ on how to handle backslashes.
// <https://github.com/micromatch/micromatch#backslashes>
// Here we use `[]` to escape the special characters in the glob pattern.
// This should work with any glob implementation.
// Inspired by CPython's `glob.escape` function.
// <https://github.com/python/cpython/blob/f0c47ea22e0980b4ff9683430b60c418a813021e/Lib/glob.py#L249-L259>
function escapePathForGlob(path: string) {
  return path.replace(/([*?{}[\]()])/g, '[$1]')
}

// Although some rules don't require type information in theory,
// in practice, when used in vue files, they still throw errors claiming that type information is needed.
// (If I understand correctly, they are the rules that have called `getParserServices` in its implementation.)
// https://github.com/typescript-eslint/typescript-eslint/issues/4755#issuecomment-1080961338
// '@typescript-eslint/consistent-type-assertions' was originally in the list but it has been fixed in
// https://github.com/typescript-eslint/typescript-eslint/pull/9921
export const additionalRulesRequiringParserServices = [
  '@typescript-eslint/consistent-type-imports',
  '@typescript-eslint/prefer-optional-chain',
]

export function createBasicSetupConfigs(
  tsSyntaxInTemplates: boolean,
  scriptLangs: ScriptLang[],
): ConfigArray {
  const mayHaveJsxInSfc =
    scriptLangs.includes('jsx') || scriptLangs.includes('tsx')

  const parser: Record<string, string | Parser.LooseParserModule> = {
    // Fallback to espree for js/jsx scripts, as well as SFCs without scripts
    // for better performance.
    js: 'espree',
    jsx: 'espree',

    ts: tseslint.parser,
    tsx: tseslint.parser,

    // Leave the template parser unspecified,
    // so that it could be determined by `<script lang="...">`
  }

  // If the user explicitly opts out of parsing TypeScript syntax in Vue templates,
  // force using `espree` for the template parser for better performance.
  if (!tsSyntaxInTemplates) {
    parser['<template>'] = 'espree'
  }

  return [
    // Must set eslint-plugin-vue's base config again no matter whether the user
    // has set it before. Otherwise it would be overridden by the tseslint's config.
    ...pluginVue.configs['flat/base'],

    {
      name: '@vue/typescript/setup',
      files: ['*.vue', '**/*.vue'],
      languageOptions: {
        parser: vueParser,
        parserOptions: {
          parser,
          // The internal espree version used by vue-eslint-parser is 9.x, which supports ES2024 at most.
          // While the parser may try to load the latest version of espree, it's not guaranteed to work.
          // For example, if npm accidentally hoists the older version to the top of the node_modules,
          // or if the user installs the older version of espree at the project root,
          // the older versions would be used.
          // But ESLint 9 allows setting the ecmaVersion to 2025, which may cause a crash.
          // So we set the ecmaVersion to 2024 here to avoid the potential issue.
          ecmaVersion: 2024,
          ecmaFeatures: {
            jsx: mayHaveJsxInSfc,
          },
          extraFileExtensions,
        },
      },
      rules: {
        'vue/block-lang': [
          'error',
          {
            script: {
              lang: scriptLangs,
              allowNoLang: scriptLangs.includes('js'),
            },
          },
        ],
      },
    },
  ]
}

export function createSkipTypeCheckingConfigs(
  nonTypeCheckableVueFiles: string[],
): ConfigArray {
  const configs = [
    {
      name: '@vue/typescript/skip-type-checking-for-js-files',
      files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
      ...tseslint.configs.disableTypeChecked,
    },
  ]

  if (nonTypeCheckableVueFiles.length > 0) {
    configs.push({
      name: '@vue/typescript/skip-type-checking-for-vue-files-without-ts',
      files: nonTypeCheckableVueFiles.map(escapePathForGlob),
      ...tseslint.configs.disableTypeChecked,
      rules: {
        ...tseslint.configs.disableTypeChecked.rules,
        ...Object.fromEntries(
          additionalRulesRequiringParserServices.map(rule => [rule, 'off']),
        ),
      },
    })
  }

  return configs
}

export function createTypeCheckingConfigs(
  typeCheckableVueFiles: string[],
  allowComponentTypeUnsafety: boolean,
): ConfigArray {
  const configs: ConfigArray = [
    {
      name: '@vue/typescript/default-project-service-for-ts-files',
      files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          projectService: true,
          extraFileExtensions,
        },
      },
    },
  ]

  if (allowComponentTypeUnsafety) {
    configs.push(
      // Due to limitations in the integration between Vue and TypeScript-ESLint,
      // TypeScript-ESLint cannot get the full type information for `.vue` files
      // and will use fallback types that contain some `any`s.
      // Therefore, we need to disable some `no-unsafe-*` rules that would error on idiomatic Vue code.
      {
        name: '@vue/typescript/type-aware-rules-in-conflict-with-vue',
        files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.vue'],
        rules: {
          // Would error on `createApp(App)`
          '@typescript-eslint/no-unsafe-argument': 'off',
          // Would error on route component configuration
          '@typescript-eslint/no-unsafe-assignment': 'off',
          // Would error on async components
          '@typescript-eslint/no-unsafe-return': 'off',

          // Might error on `defineExpose` + `useTemplateRef` usages
          '@typescript-eslint/no-unsafe-call': 'off',
          '@typescript-eslint/no-unsafe-member-access': 'off',
        },
      },
    )
  }

  if (typeCheckableVueFiles.length > 0) {
    configs.push({
      name: '@vue/typescript/default-project-service-for-vue-files',
      files: typeCheckableVueFiles.map(escapePathForGlob),
      languageOptions: {
        parser: vueParser,
        parserOptions: {
          projectService: true,
          parser: tseslint.parser,
          extraFileExtensions,
        },
      },
    })
  }

  return configs
}
