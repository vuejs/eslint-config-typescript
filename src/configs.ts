import tseslint from 'typescript-eslint'
import type { FlatConfig } from '@typescript-eslint/utils/ts-eslint'

const CONFIG_NAMES = [
  'all',
  'base',
  'disableTypeChecked',
  'eslintRecommended',
  'recommended',
  'recommendedTypeChecked',
  'recommendedTypeCheckedOnly',
  'strict',
  'strictTypeChecked',
  'strictTypeCheckedOnly',
  'stylistic',
  'stylisticTypeChecked',
  'stylisticTypeCheckedOnly',
] as const
export type ExtendableConfigName = (typeof CONFIG_NAMES)[number]

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

const VUE_TS_CONFIG = Symbol('@vue/eslint-config-typescript/vue-ts-config')
const TS_FILES_GLOB = '**/*.ts'
const VUE_FILES_GLOB = '**/*.vue'

type VueTsConfigMeta = {
  configName: ExtendableConfigName
  needsTypeChecking: boolean
}

export type VueTsConfig = FlatConfig.Config & {
  [VUE_TS_CONFIG]: VueTsConfigMeta
}

export type ExtendConfigOptions = {
  name?: string
  files?: (string | string[])[]
  ignores?: string[]
}

function needsTypeChecking(configName: ExtendableConfigName): boolean {
  if (configName === 'disableTypeChecked') {
    return false
  }
  if (configName === 'all') {
    return true
  }
  return configName.includes('TypeChecked')
}

function markVueTsConfig(
  config: FlatConfig.Config,
  meta: VueTsConfigMeta,
): VueTsConfig {
  return {
    ...config,
    [VUE_TS_CONFIG]: meta,
  }
}

function createVueTsConfig(
  configName: ExtendableConfigName,
): FlatConfig.ConfigArray {
  const meta = {
    configName,
    needsTypeChecking: needsTypeChecking(configName),
  } satisfies VueTsConfigMeta

  return toArray(tseslint.configs[configName])
    .flat()
    .map((config: FlatConfig.Config) => markVueTsConfig(config, meta))
}

function hasTsMatcher(files: (string | string[])[]): boolean {
  return files.some(fileMatcher =>
    Array.isArray(fileMatcher)
      ? fileMatcher.includes(TS_FILES_GLOB)
      : fileMatcher === TS_FILES_GLOB,
  )
}

function addVueMatcher(files: (string | string[])[]): (string | string[])[] {
  const vueMatchers = files.reduce<(string | string[])[]>(
    (result, fileMatcher) => {
      if (Array.isArray(fileMatcher)) {
        if (fileMatcher.includes(TS_FILES_GLOB)) {
          result.push(
            fileMatcher.map(matcher =>
              matcher === TS_FILES_GLOB ? VUE_FILES_GLOB : matcher,
            ),
          )
        }
        return result
      }

      if (fileMatcher === TS_FILES_GLOB) {
        result.push(VUE_FILES_GLOB)
      }
      return result
    },
    [],
  )

  return vueMatchers.length > 0 ? [...files, ...vueMatchers] : files
}

export function isVueTsConfig(
  config: FlatConfig.Config,
): config is VueTsConfig {
  return VUE_TS_CONFIG in config
}

export function extendVueTsConfig(
  config: VueTsConfig,
  restOfConfig: ExtendConfigOptions,
): VueTsConfig {
  const name = [restOfConfig.name, config.name].filter(Boolean).join('__')

  return {
    ...config,
    ...(restOfConfig.files && { files: restOfConfig.files }),
    ...(restOfConfig.ignores && { ignores: restOfConfig.ignores }),
    ...(name && { name }),
  }
}

export function vueTsConfigNeedsTypeChecking(config: VueTsConfig): boolean {
  return config[VUE_TS_CONFIG].needsTypeChecking
}

export function resolveVueTsConfig(config: VueTsConfig): FlatConfig.Config {
  const { [VUE_TS_CONFIG]: _meta, ...resolvedConfig } = config

  return {
    ...resolvedConfig,
    ...(resolvedConfig.files && hasTsMatcher(resolvedConfig.files)
      ? { files: addVueMatcher(resolvedConfig.files) }
      : {}),
  }
}

export const vueTsConfigs = Object.fromEntries(
  CONFIG_NAMES.map(name => [name, createVueTsConfig(name)]),
) as Record<ExtendableConfigName, FlatConfig.Config | FlatConfig.ConfigArray>
