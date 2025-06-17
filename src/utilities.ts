import process from 'node:process'
import tseslint from 'typescript-eslint'
import type { TSESLint } from '@typescript-eslint/utils'
import pluginVue from 'eslint-plugin-vue'

import { TsEslintConfigForVue } from './configs'
import groupVueFiles from './groupVueFiles'
import {
  additionalRulesRequiringParserServices,
  createBasicSetupConfigs,
  createSkipTypeCheckingConfigs,
  createTypeCheckingConfigs,
} from './internals'
import type { ScriptLang } from './internals'

import { omit, pipe, partition } from './fpHelpers'

type ConfigItem = TSESLint.FlatConfig.Config
type InfiniteDepthConfigWithExtendsAndVueSupport =
  | TsEslintConfigForVue
  | ConfigItemWithExtendsAndVueSupport
  | InfiniteDepthConfigWithExtendsAndVueSupport[]
interface ConfigItemWithExtendsAndVueSupport extends ConfigItem {
  extends?: InfiniteDepthConfigWithExtendsAndVueSupport[]
}

export type ProjectOptions = {
  /**
   * Whether to parse TypeScript syntax in Vue templates.
   * Defaults to `true`.
   * Setting it to `false` could improve performance.
   * But TypeScript syntax in Vue templates will then lead to syntax errors.
   * Also, type-aware rules won't be applied to expressions in templates in that case.
   */
  tsSyntaxInTemplates?: boolean

  /**
   * Allowed script languages in `vue` files.
   * Defaults to `['ts']`
   */
  scriptLangs?: ScriptLang[]

  /**
   * Whether to override some `no-unsafe-*` rules to avoid false positives on Vue component operations.
   * Defaults to `true`.
   * 
   * Due to limitations in the integration between Vue and TypeScript-ESLint,
   * TypeScript-ESLint cannot get the full type information for `.vue` files
   * and will use fallback types that contain some `any`s.
   * Therefore, some `no-unsafe-*` rules will error on functions that operate on Vue components,
   * such as `createApp`, `createRouter`, `useTemplateRef`, etc.
   * 
   * Setting this option to `true` will override those `no-unsafe-*` rules
   * to allow these patterns in the project.
   * 
   * If you're using a metaframework such as Nuxt or Quasar
   * that handles app creation & router configuration for you,
   * you might not need to interact with component types directly.
   * Similarly, if you're using TSX exclusively,
   * you can set this to `false` for stricter type checking.
   */
  allowComponentTypeUnsafety?: boolean

  /**
   * The root directory of the project.
   * Defaults to `process.cwd()`.
   */
  rootDir?: string
}

let projectOptions = {
  tsSyntaxInTemplates: true as boolean,
  scriptLangs: ['ts'] as ScriptLang[],
  allowComponentTypeUnsafety: true as boolean,
  rootDir: process.cwd(),
} satisfies ProjectOptions

// This function, if called, is guaranteed to be executed before `defineConfigWithVueTs`,
// so mutating the `projectOptions` object is safe and will be reflected in the final ESLint config.
export function configureVueProject(userOptions: ProjectOptions): void {
  if (userOptions.tsSyntaxInTemplates !== undefined) {
    projectOptions.tsSyntaxInTemplates = userOptions.tsSyntaxInTemplates
  }
  if (userOptions.allowComponentTypeUnsafety !== undefined) {
    projectOptions.allowComponentTypeUnsafety = userOptions.allowComponentTypeUnsafety
  }
  if (userOptions.scriptLangs) {
    projectOptions.scriptLangs = userOptions.scriptLangs
  }
  if (userOptions.rootDir) {
    projectOptions.rootDir = userOptions.rootDir
  }
}

// The *Raw* types are those with placeholders not yet resolved.
type RawConfigItemWithExtends =
  | ConfigItemWithExtendsAndVueSupport
  | TsEslintConfigForVue
type RawConfigItem = ConfigItem | TsEslintConfigForVue

export function defineConfigWithVueTs(
  ...configs: InfiniteDepthConfigWithExtendsAndVueSupport[]
): ConfigItem[] {
  return pipe(
    configs,
    flattenConfigs,
    deduplicateVuePlugin,
    insertAndReorderConfigs,
    resolveVueTsConfigs,
    tseslint.config, // this might not be necessary, but it doesn't hurt to keep it
  )
}

function flattenConfigs(
  configs: InfiniteDepthConfigWithExtendsAndVueSupport[],
): RawConfigItem[] {
  // Be careful that our TS types don't guarantee that `extends` is removed from the final config
  // Modified from
  // https://github.com/typescript-eslint/typescript-eslint/blob/d30a497ef470b5a06ca0a5dde9543b6e00c87a5f/packages/typescript-eslint/src/config-helper.ts#L98-L143
  // No handling of undefined for now for simplicity

  // @ts-expect-error -- intentionally an infinite type
  return (configs.flat(Infinity) as RawConfigItemWithExtends[]).flatMap(
    (c: RawConfigItemWithExtends): RawConfigItem | RawConfigItem[] => {
      if (c instanceof TsEslintConfigForVue) {
        return c
      }

      const { extends: extendsArray, ...restOfConfig } = c
      if (extendsArray == null || extendsArray.length === 0) {
        return restOfConfig
      }

      const flattenedExtends: RawConfigItem[] = extendsArray.flatMap(
        configToExtend =>
          Array.isArray(configToExtend)
            ? flattenConfigs(configToExtend)
            : [configToExtend],
      )

      return [
        ...flattenedExtends.map((extension: RawConfigItem) => {
          if (extension instanceof TsEslintConfigForVue) {
            return extension.asExtendedWith(restOfConfig)
          } else {
            const name = [restOfConfig.name, extension.name]
              .filter(Boolean)
              .join('__')
            return {
              ...extension,
              ...(restOfConfig.files && { files: restOfConfig.files }),
              ...(restOfConfig.ignores && { ignores: restOfConfig.ignores }),
              ...(name && { name }),
            }
          }
        }),

        // If restOfConfig contains nothing but `ignores`/`name`, we shouldn't return it
        // Because that would make it a global `ignores` config, which is not what we want
        ...(Object.keys(omit(restOfConfig, ['ignores', 'name'])).length > 0
          ? [restOfConfig]
          : []),
      ]
    },
  )
}

function resolveVueTsConfigs(configs: RawConfigItem[]): ConfigItem[] {
  return configs.flatMap(config =>
    config instanceof TsEslintConfigForVue ? config.toConfigArray() : config,
  )
}

type ExtractedConfig = {
  files?: (string | string[])[]
  rules: NonNullable<ConfigItem['rules']>
}
const userTypeAwareConfigs: ExtractedConfig[] = []

/**
 * This function reorders the config array to make sure it satisfies the following layout:
 *
 * ```
 * [FIRST-EXTENDED-CONFIG]
 * ...
 * [LAST-EXTENDED-CONFIG]
 * [BASIC SETUP]
 *   pluginVue.configs['flat/base'],
 *   '@vue/typescript/setup'
 * [ALL-OTHER-TYPE-AWARE-RULES-CONFIGURED-BY-USERS]
 * [ERROR PREVENTION & PERFORMANCE OPTIMIZATION]
 *   '@vue/typescript/skip-type-checking-for-js-files'
 *   '@vue/typescript/skip-type-checking-for-vue-files-without-ts'
 * [ONLY REQUIRED WHEN ONE-OR-MORE TYPE-AWARE-RULES ARE TURNED-ON]
 *   '@vue/typescript/default-project-service-for-ts-files'
 *   '@vue/typescript/default-project-service-for-vue-files'
 *   '@vue/typescript/type-aware-rules-in-conflit-with-vue'
 * ```
 */
function insertAndReorderConfigs(configs: RawConfigItem[]): RawConfigItem[] {
  const lastExtendedConfigIndex = configs.findLastIndex(
    config => config instanceof TsEslintConfigForVue,
  )

  if (lastExtendedConfigIndex === -1) {
    return configs
  }

  const vueFiles = groupVueFiles(projectOptions.rootDir)
  const configsWithoutTypeAwareRules = configs.map(extractTypeAwareRules)

  const hasTypeAwareConfigs = configs.some(
    config =>
      config instanceof TsEslintConfigForVue && config.needsTypeChecking(),
  )
  const needsTypeAwareLinting =
    hasTypeAwareConfigs || userTypeAwareConfigs.length > 0

  return [
    ...configsWithoutTypeAwareRules.slice(0, lastExtendedConfigIndex + 1),
    ...createBasicSetupConfigs(
      projectOptions.tsSyntaxInTemplates,
      projectOptions.scriptLangs,
    ),

    // user-turned-off type-aware rules must come after the last extended config
    // in case some rules re-enabled by the extended config
    // user-turned-on type-aware rules must come before skipping type-checking
    // in case some rules targets those can't be type-checked files
    // So we extract all type-aware rules by users and put them in the middle
    ...userTypeAwareConfigs,

    ...(needsTypeAwareLinting
      ? [
          ...createSkipTypeCheckingConfigs(vueFiles.nonTypeCheckable),
          ...createTypeCheckingConfigs(vueFiles.typeCheckable, projectOptions.allowComponentTypeUnsafety),
        ]
      : []),

    ...configsWithoutTypeAwareRules.slice(lastExtendedConfigIndex + 1),
  ]
}

function extractTypeAwareRules(config: RawConfigItem): RawConfigItem {
  if (config instanceof TsEslintConfigForVue) {
    return config
  }

  if (!config.rules) {
    return config
  }

  const [typeAwareRuleEntries, otherRuleEntries] = partition(
    Object.entries(config.rules),
    ([name]) => doesRuleRequireTypeInformation(name),
  )

  if (typeAwareRuleEntries.length > 0) {
    userTypeAwareConfigs.push({
      rules: Object.fromEntries(typeAwareRuleEntries),
      ...(config.files && { files: config.files }),
    })
  }

  return {
    ...config,
    rules: Object.fromEntries(otherRuleEntries),
  }
}

const rulesRequiringTypeInformation = new Set(
  Object.entries(tseslint.plugin.rules!)
    // @ts-expect-error
    .filter(([_name, def]) => def?.meta?.docs?.requiresTypeChecking)
    .map(([name, _def]) => `@typescript-eslint/${name}`)
    .concat(additionalRulesRequiringParserServices),
)
function doesRuleRequireTypeInformation(ruleName: string): boolean {
  return rulesRequiringTypeInformation.has(ruleName)
}

function deduplicateVuePlugin(configs: RawConfigItem[]): RawConfigItem[] {
  return configs.map(config => {
    if (config instanceof TsEslintConfigForVue || !config.plugins?.vue) {
      return config
    }

    const currentVuePlugin = config.plugins.vue
    if (currentVuePlugin !== pluginVue) {
      const currentVersion: string = currentVuePlugin.meta?.version || 'unknown'
      const expectedVersion: string = pluginVue.meta?.version || 'unknown'

      const configName: string = config.name || 'unknown config'

      console.warn(
        `Warning: Multiple instances of eslint-plugin-vue detected in ${configName}. ` +
          `Replacing version ${currentVersion} with version ${expectedVersion}.`,
      )

      return {
        ...config,
        plugins: {
          ...config.plugins,
          vue: pluginVue,
        },
      }
    }

    return config
  })
}
