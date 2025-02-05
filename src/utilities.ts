import process from 'node:process'
import * as tseslint from 'typescript-eslint'
import { TsEslintConfigForVue } from './configs'
import groupVueFiles from './groupVueFiles'
import {
  additionalRulesRequiringParserServices,
  createBasicSetupConfigs,
  createSkipTypeCheckingConfigs,
  createTypeCheckingConfigs,
} from './internals'

import type { ScriptLang } from './internals'

type ConfigArray = ReturnType<typeof tseslint.config>
type Rules = NonNullable<ConfigArray[number]['rules']>

type ConfigObjectOrPlaceholder = ConfigArray[number] | TsEslintConfigForVue
type InfiniteDepthConfigWithVueSupport =
  | ConfigObjectOrPlaceholder
  | InfiniteDepthConfigWithVueSupport[]

export type ProjectOptions = {
  /**
   * Whether to parse TypeScript syntax in Vue templates.
   * Defaults to `true`.
   * Setting it to `false` could improve performance.
   * But TypeScript syntax in Vue templates will then lead to syntax errors.
   * Also, type-aware rules won't be applied to expressions in templates in that case.
   */
  tsInTemplates?: boolean

  /**
   * Allowed script languages in `vue` files.
   * Defaults to `['ts']`
   */
  scriptLangs?: ScriptLang[]

  /**
   * The root directory of the project.
   * Defaults to `process.cwd()`.
   */
  rootDir?: string
}

let projectOptions: ProjectOptions = {
  tsInTemplates: true,
  scriptLangs: ['ts'],
  rootDir: process.cwd(),
}

// This function, if called, is guaranteed to be executed before `defineConfigWithVueTs`,
// so mutating the `projectOptions` object is safe and will be reflected in the final ESLint config.
export function configureVueProject(userOptions: ProjectOptions): void {
  if (userOptions.tsInTemplates !== undefined) {
    projectOptions.tsInTemplates = userOptions.tsInTemplates
  }
  if (userOptions.scriptLangs) {
    projectOptions.scriptLangs = userOptions.scriptLangs
  }
  if (userOptions.rootDir) {
    projectOptions.rootDir = userOptions.rootDir
  }
}

export function defineConfigWithVueTs(
  ...configs: InfiniteDepthConfigWithVueSupport[]
): ConfigArray {
  // @ts-ignore
  const flattenedConfigs: ConfigObjectOrPlaceholder[] = configs.flat(Infinity)

  const reorderedConfigs = insertAndReorderConfigs(flattenedConfigs)

  const normalizedConfigs = reorderedConfigs.map(config =>
    config instanceof TsEslintConfigForVue ? config.toConfigArray() : config,
  )

  return tseslint.config(...normalizedConfigs)
}

// This function reorders the config array to make sure it satisfies the following layout:
//
// [FIRST-EXTENDED-CONFIG]
// ...
// [LAST-EXTENDED-CONFIG]
//
// [BASIC SETUP]
//   pluginVue.configs['flat/base'],
//   '@vue/typescript/setup'
//
// [ALL-OTHER-TYPE-AWARE-RULES-CONFIGURED-BY-USERS]
//
// [ERROR PREVENTION & PERFORMANCE OPTIMIZATION]
//   '@vue/typescript/skip-type-checking-for-js-files'
//   '@vue/typescript/skip-type-checking-for-vue-files-without-ts'
//
// [ONLY REQUIRED WHEN ONE-OR-MORE TYPE-AWARE RULES ARE TURNED-ON]
//   '@vue/typescript/default-project-service-for-ts-files'
//   '@vue/typescript/default-project-service-for-vue-files'
//   '@vue/typescript/type-aware-rules-in-conflit-with-vue'

type ExtractedConfig = {
  files?: (string | string[])[]
  rules: Rules
}
const userTypeAwareConfigs: ExtractedConfig[] = []

function insertAndReorderConfigs(
  configs: ConfigObjectOrPlaceholder[],
): ConfigObjectOrPlaceholder[] {
  const lastExtendedConfigIndex = configs.findLastIndex(
    config => config instanceof TsEslintConfigForVue,
  )

  if (lastExtendedConfigIndex === -1) {
    return configs
  }

  const vueFiles = groupVueFiles(projectOptions.rootDir!)
  const configsWithoutTypeAwareRules = configs.map(extractTypeAwareRules)

  const hasTypeAwareConfigs = configs.some(
    config =>
      config instanceof TsEslintConfigForVue && config.needsTypeChecking(),
  )
  const needsTypeAwareLinting =
    hasTypeAwareConfigs || userTypeAwareConfigs.length > 0

  return [
    ...configsWithoutTypeAwareRules.slice(0, lastExtendedConfigIndex + 1),
    ...createBasicSetupConfigs(projectOptions.tsInTemplates!, projectOptions.scriptLangs!),

    // user-turned-off type-aware rules must come after the last extended config
    // in case some rules re-enabled by the extended config
    // user-turned-on type-aware rules must come before skipping type-checking
    // in case some rules targets those can't be type-checked files
    // So we extract all type-aware rules by users and put them in the middle
    ...userTypeAwareConfigs,

    ...(needsTypeAwareLinting
      ? [
          ...createSkipTypeCheckingConfigs(vueFiles.nonTypeCheckable),
          ...createTypeCheckingConfigs(vueFiles.typeCheckable),
        ]
      : []),

    ...configsWithoutTypeAwareRules.slice(lastExtendedConfigIndex + 1),
  ]
}

function extractTypeAwareRules(
  config: ConfigObjectOrPlaceholder,
): ConfigObjectOrPlaceholder {
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

function partition<T>(
  array: T[],
  predicate: (element: T) => boolean,
): [T[], T[]] {
  const truthy: T[] = []
  const falsy: T[] = []
  for (const element of array) {
    if (predicate(element)) {
      truthy.push(element)
    } else {
      falsy.push(element)
    }
  }
  return [truthy, falsy]
}
