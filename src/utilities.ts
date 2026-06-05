import process from 'node:process'
import tseslint from 'typescript-eslint'
import type { TSESLint } from '@typescript-eslint/utils'
import type { FlatConfig } from '@typescript-eslint/utils/ts-eslint'
import pluginVue from 'eslint-plugin-vue'

import {
  extendVueTsConfig,
  isVueTsConfig,
  resolveVueTsConfig,
  vueTsConfigNeedsTypeChecking,
} from './configs'
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
type ConfigInput = ConfigItemWithExtendsAndVueSupport | ConfigInput[]
interface ConfigItemWithExtendsAndVueSupport extends ConfigItem {
  extends?: ConfigInput[]
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
   * Allow patterns to match entries that begin with a period (.).
   * Default is `false`.
   */
  includeDotFolders?: boolean

  /**
   * The root directory of the project.
   * Defaults to `process.cwd()`.
   */
  rootDir?: string
}

type ResolvedProjectOptions = {
  tsSyntaxInTemplates: boolean
  scriptLangs: ScriptLang[]
  allowComponentTypeUnsafety: boolean
  includeDotFolders: boolean
  rootDir: string
}

type RawConfigItem = ConfigItem

type ExtractedConfig = {
  files?: (string | string[])[]
  rules: NonNullable<ConfigItem['rules']>
}

type TransformState = {
  globalIgnores: string[]
  userTypeAwareConfigs: ExtractedConfig[]
}

type MaybePromise<T> = T | PromiseLike<T>
type AwaitableConfigInput = MaybePromise<ConfigInput | ConfigInput[]>

const PROJECT_OPTION_KEYS = new Set([
  'tsSyntaxInTemplates',
  'scriptLangs',
  'allowComponentTypeUnsafety',
  'includeDotFolders',
  'rootDir',
])

const DEFAULT_PROJECT_OPTIONS = {
  tsSyntaxInTemplates: true,
  scriptLangs: ['ts'],
  allowComponentTypeUnsafety: true,
  includeDotFolders: false,
  rootDir: process.cwd(),
} satisfies ResolvedProjectOptions

let projectOptions: ResolvedProjectOptions = { ...DEFAULT_PROJECT_OPTIONS }

function resolveProjectOptions(
  userOptions: ProjectOptions = {},
): ResolvedProjectOptions {
  return {
    tsSyntaxInTemplates:
      userOptions.tsSyntaxInTemplates ?? projectOptions.tsSyntaxInTemplates,
    scriptLangs: userOptions.scriptLangs ?? projectOptions.scriptLangs,
    allowComponentTypeUnsafety:
      userOptions.allowComponentTypeUnsafety ??
      projectOptions.allowComponentTypeUnsafety,
    includeDotFolders:
      userOptions.includeDotFolders ?? projectOptions.includeDotFolders,
    rootDir: userOptions.rootDir ?? projectOptions.rootDir,
  }
}

function createTransformState(): TransformState {
  return {
    globalIgnores: [],
    userTypeAwareConfigs: [],
  }
}

function normalizeConfigInput(
  config: ConfigInput | ConfigInput[],
): ConfigInput[] {
  return Array.isArray(config) ? config : [config]
}

function isPlainObject(
  value: unknown,
): value is Record<string | number | symbol, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function classifyFirstArg(
  value: unknown,
): 'options' | 'config' | 'mixed-options-and-config' {
  if (!isPlainObject(value)) {
    return 'config'
  }

  const keys = Object.keys(value)
  if (keys.length === 0) {
    return 'config'
  }

  const optionKeyCount = keys.filter(key => PROJECT_OPTION_KEYS.has(key)).length
  if (optionKeyCount === 0) {
    return 'config'
  }
  if (optionKeyCount === keys.length) {
    return 'options'
  }

  return 'mixed-options-and-config'
}

function splitOptionsAndConfigInputs(args: unknown[]): {
  configInputs: AwaitableConfigInput[]
  userOptions: ProjectOptions
} {
  if (args.length === 0) {
    return {
      configInputs: [],
      userOptions: {},
    }
  }

  const firstArg = args[0]
  const firstArgKind = classifyFirstArg(firstArg)

  if (firstArgKind === 'mixed-options-and-config') {
    throw new TypeError(
      'The first argument to `withVueTs(...)` cannot mix Vue project options with ESLint config keys. Pass project options as the first argument and move ESLint config fields into a separate config object.',
    )
  }

  if (firstArgKind !== 'options') {
    return {
      configInputs: args as AwaitableConfigInput[],
      userOptions: {},
    }
  }

  return {
    configInputs: args.slice(1) as AwaitableConfigInput[],
    userOptions: firstArg as ProjectOptions,
  }
}

function applyVueTsTransform(
  configs: ConfigInput[],
  options: ResolvedProjectOptions,
): ConfigItem[] {
  const state = createTransformState()

  return pipe(
    configs,
    flattenConfigs,
    rawConfigs => collectGlobalIgnores(rawConfigs, state),
    deduplicateVuePlugin,
    rawConfigs => insertAndReorderConfigs(rawConfigs, options, state),
    resolveVueTsConfigs,
    tseslint.config, // this might not be necessary, but it doesn't hurt to keep it
  )
}

// This function, if called, is guaranteed to be executed before `defineConfigWithVueTs`,
// so mutating the `projectOptions` object is safe and will be reflected in the final ESLint config.
export function configureVueProject(userOptions: ProjectOptions): void {
  if (userOptions.tsSyntaxInTemplates !== undefined) {
    projectOptions.tsSyntaxInTemplates = userOptions.tsSyntaxInTemplates
  }
  if (userOptions.allowComponentTypeUnsafety !== undefined) {
    projectOptions.allowComponentTypeUnsafety =
      userOptions.allowComponentTypeUnsafety
  }
  if (userOptions.scriptLangs) {
    projectOptions.scriptLangs = userOptions.scriptLangs
  }
  if (userOptions.rootDir) {
    projectOptions.rootDir = userOptions.rootDir
  }
  if (userOptions.includeDotFolders !== undefined) {
    projectOptions.includeDotFolders = userOptions.includeDotFolders
  }
}

export function defineConfigWithVueTs(...configs: ConfigInput[]): ConfigItem[] {
  return applyVueTsTransform(configs, resolveProjectOptions())
}

export function withVueTs(
  ...configs: AwaitableConfigInput[]
): Promise<ConfigItem[]>
export function withVueTs(
  options: ProjectOptions,
  ...configs: AwaitableConfigInput[]
): Promise<ConfigItem[]>
export async function withVueTs(...args: unknown[]): Promise<ConfigItem[]> {
  const { configInputs, userOptions } = splitOptionsAndConfigInputs(args)
  const resolvedConfigs = await Promise.all(configInputs)

  return applyVueTsTransform(
    resolvedConfigs.flatMap(config => normalizeConfigInput(config)),
    resolveProjectOptions(userOptions),
  )
}

function flattenConfigs(configs: ConfigInput[]): RawConfigItem[] {
  // Be careful that our TS types don't guarantee that `extends` is removed from the final config
  // Modified from
  // https://github.com/typescript-eslint/typescript-eslint/blob/d30a497ef470b5a06ca0a5dde9543b6e00c87a5f/packages/typescript-eslint/src/config-helper.ts#L98-L143
  // No handling of undefined for now for simplicity

  const flattenedConfigs = (configs as unknown[]).flat(
    Infinity,
  ) as ConfigItemWithExtendsAndVueSupport[]

  return flattenedConfigs.flatMap(
    (
      config: ConfigItemWithExtendsAndVueSupport,
    ): RawConfigItem | RawConfigItem[] => {
      if (isVueTsConfig(config)) {
        return config
      }

      const { extends: extendsArray, ...restOfConfig } = config
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
          if (isVueTsConfig(extension)) {
            return extendVueTsConfig(extension, restOfConfig)
          }

          const name = [restOfConfig.name, extension.name]
            .filter(Boolean)
            .join('__')
          return {
            ...extension,
            ...(restOfConfig.files && { files: restOfConfig.files }),
            ...(restOfConfig.ignores && { ignores: restOfConfig.ignores }),
            ...(name && { name }),
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

/**
 * Fields that are considered metadata and not part of the config object.
 */
const META_FIELDS = new Set(['name', 'basePath'])

function collectGlobalIgnores(
  configs: RawConfigItem[],
  state: TransformState,
): RawConfigItem[] {
  configs.forEach(config => {
    if (isVueTsConfig(config) || !config.ignores) {
      return
    }

    if (Object.keys(config).filter(key => !META_FIELDS.has(key)).length !== 1)
      return

    // Configs that only contain `ignores` (and possibly `name`/`basePath`) are treated as global ignores
    state.globalIgnores.push(...config.ignores)
  })

  return configs
}

function resolveVueTsConfigs(configs: RawConfigItem[]): ConfigItem[] {
  return configs.map(config =>
    isVueTsConfig(config) ? resolveVueTsConfig(config) : config,
  )
}

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
function insertAndReorderConfigs(
  configs: RawConfigItem[],
  options: ResolvedProjectOptions,
  state: TransformState,
): RawConfigItem[] {
  const lastExtendedConfigIndex = configs.findLastIndex(config =>
    isVueTsConfig(config),
  )

  if (lastExtendedConfigIndex === -1) {
    return configs
  }

  // TODO: Avoid scanning all `.vue` files eagerly here. This should be deferred
  // until we actually need file-by-file type-checkability information.
  const vueFiles = groupVueFiles(
    options.rootDir,
    state.globalIgnores,
    options.includeDotFolders,
  )
  const configsWithoutTypeAwareRules = configs.map(config =>
    extractTypeAwareRules(config, state),
  )

  const hasTypeAwareConfigs = configs.some(
    config => isVueTsConfig(config) && vueTsConfigNeedsTypeChecking(config),
  )
  const needsTypeAwareLinting =
    hasTypeAwareConfigs || state.userTypeAwareConfigs.length > 0

  return [
    ...configsWithoutTypeAwareRules.slice(0, lastExtendedConfigIndex + 1),
    ...createBasicSetupConfigs(
      options.tsSyntaxInTemplates,
      options.scriptLangs,
    ),

    // user-turned-off type-aware rules must come after the last extended config
    // in case some rules re-enabled by the extended config
    // user-turned-on type-aware rules must come before skipping type-checking
    // in case some rules targets those can't be type-checked files
    // So we extract all type-aware rules by users and put them in the middle
    ...state.userTypeAwareConfigs,

    ...(needsTypeAwareLinting
      ? [
          ...createSkipTypeCheckingConfigs(vueFiles.nonTypeCheckable),
          ...createTypeCheckingConfigs(
            vueFiles.typeCheckable,
            options.allowComponentTypeUnsafety,
          ),
        ]
      : []),

    ...configsWithoutTypeAwareRules.slice(lastExtendedConfigIndex + 1),
  ]
}

function extractTypeAwareRules(
  config: RawConfigItem,
  state: TransformState,
): RawConfigItem {
  if (isVueTsConfig(config) || !config.rules) {
    return config
  }

  const [typeAwareRuleEntries, otherRuleEntries] = partition(
    Object.entries(config.rules),
    ([name]) => doesRuleRequireTypeInformation(name),
  )

  if (typeAwareRuleEntries.length > 0) {
    state.userTypeAwareConfigs.push({
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
  Object.entries((tseslint.plugin as FlatConfig.Plugin).rules!)
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
    if (isVueTsConfig(config) || !config.plugins?.vue) {
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
