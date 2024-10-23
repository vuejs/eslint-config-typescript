import fs from 'node:fs'
import process from 'node:process'

import * as tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import pluginVue from 'eslint-plugin-vue'

import fg from 'fast-glob'

type ExtendableConfigName = keyof typeof tseslint.configs
type ScriptLang = 'ts' | 'tsx' | 'js' | 'jsx'
type ConfigOptions = {
  extends?: Array<ExtendableConfigName>
  supportedScriptLangs?: Record<ScriptLang, boolean>
  rootDir?: string
}

type ConfigArray = ReturnType<typeof tseslint.config>

// https://typescript-eslint.io/troubleshooting/typed-linting/performance#changes-to-extrafileextensions-with-projectservice
const extraFileExtensions = ['.vue']

export default function createConfig({
  extends: configNamesToExtend = ['recommended'],
  supportedScriptLangs = { ts: true, tsx: false, js: false, jsx: false },
  rootDir = process.cwd(),
}: ConfigOptions = {}): ConfigArray {
  // Only `.vue` files with `<script lang="ts">` or `<script setup lang="ts">` can be type-checked.
  const { vueFilesWithScriptTs, otherVueFiles } = fg
    .sync(['**/*.vue'], {
      cwd: rootDir,
      ignore: ['**/node_modules/**'],
    })
    .reduce(
      (acc, file) => {
        const contents = fs.readFileSync(file, 'utf8')
        // contents matches the <script lang="ts"> (there can be anything but `>` between `script` and `lang`)
        if (/<script[^>]*\blang\s*=\s*"ts"[^>]*>/i.test(contents)) {
          acc.vueFilesWithScriptTs.push(file)
        } else {
          acc.otherVueFiles.push(file)
        }
        return acc
      },
      { vueFilesWithScriptTs: [] as string[], otherVueFiles: [] as string[] },
    )

  const projectServiceConfigs: ConfigArray = [
    {
      name: 'vue-typescript/skip-type-checking-for-js-files',
      files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
      ...tseslint.configs.disableTypeChecked,
    },
  ]

  if (otherVueFiles.length > 0) {
    projectServiceConfigs.push({
      name: 'vue-typescript/skip-type-checking-for-vue-files-without-ts',
      files: otherVueFiles,
      ...tseslint.configs.disableTypeChecked,
      rules: {
        ...tseslint.configs.disableTypeChecked.rules,
        // Although some rules don't require type information in theory,
        // in practice, when used in vue files, they still throw errors claiming that type information is needed.
        // (If I understand correctly, they are the rules that have called `getParserServices` in its implementation.)
        // https://github.com/typescript-eslint/typescript-eslint/issues/4755#issuecomment-1080961338
        '@typescript-eslint/consistent-type-imports': 'off',
        '@typescript-eslint/prefer-optional-chain': 'off',
      },
    })
  }

  // More meaningful error message for the user, in case they didn't know the correct config name.
  for (const name of configNamesToExtend) {
    if (!tseslint.configs[name]) {
      const nameInCamelCase = name.replace(/-([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      )

      // @ts-expect-error
      if (tseslint.configs[nameInCamelCase]) {
        throw new Error(
          `The config name "${name}" is not supported in "extends". ` +
            `Please use "${nameInCamelCase}" instead.`,
        )
      }

      throw new Error(`Unknown config name in "extends": ${name}.`)
    }
  }

  const mayHaveJsxInSfc = supportedScriptLangs.jsx || supportedScriptLangs.tsx
  const needsTypeAwareLinting = configNamesToExtend.some(
    name =>
      name === 'all' ||
      (name.includes('TypeChecked') && name !== 'disableTypeChecked'),
  )

  if (needsTypeAwareLinting) {
    projectServiceConfigs.push({
      name: 'vue-typescript/default-project-service-for-ts-files',
      files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          projectService: true,
          extraFileExtensions,
        },
      },
    })

    if (vueFilesWithScriptTs.length > 0) {
      projectServiceConfigs.push({
        name: 'vue-typescript/default-project-service-for-vue-files',
        files: vueFilesWithScriptTs,
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

    // Vue's own typing inevitably contains some `any`s, so some of the `no-unsafe-*` rules can't be used.
    projectServiceConfigs.push({
      name: 'vue-typescript/type-aware-rules-in-conflit-with-vue',
      files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.vue'],
      rules: {
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
      },
    })

    if (mayHaveJsxInSfc) {
      console.warn(
        'Type-aware linting is not supported in Vue SFCs with JSX syntax.' +
          'Rules that require type information are skipped in these files.',
      )
    }
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
        parser: vueParser,
        parserOptions: {
          parser: {
            // Fallback to espree for js/jsx scripts, as well as SFCs without scripts
            // for better performance.
            js: 'espree',
            jsx: 'espree',

            ts: tseslint.parser,
            tsx: tseslint.parser,

            // Leave the template parser unspecified,
            // so that it could be determined by `<script lang="...">`
          },
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
