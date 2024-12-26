import tseslint from 'typescript-eslint'

export type ExtendableConfigName = keyof typeof tseslint.configs
type ConfigArray = (typeof tseslint.configs)[ExtendableConfigName]

// TODO: use enum
export type VueTsPreset =
  `PLACEHOLDER_THAT_MUST_BE_WRAPPED_INSIDE_defineConfig_${ExtendableConfigName}`
export type VueTsPresets = Record<ExtendableConfigName, VueTsPreset>

export const configs: VueTsPresets = Object.keys(tseslint.configs).reduce(
  (configs, name) => {
    configs[name as ExtendableConfigName] =
      `PLACEHOLDER_THAT_MUST_BE_WRAPPED_INSIDE_defineConfig_${name as ExtendableConfigName}`
    return configs
  },
  {} as VueTsPresets,
)

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export function getConfigForPlaceholder(
  placeholder: VueTsPreset,
): ConfigArray {
  return toArray(
    tseslint.configs[
      placeholder.replace(
        /^PLACEHOLDER_THAT_MUST_BE_WRAPPED_INSIDE_defineConfig_/,
        '',
      ) as ExtendableConfigName
    ],
  )
    .flat()
    .map(config =>
      config.files && config.files.includes('**/*.ts')
        ? {
            ...config,
            files: [...config.files, '**/*.vue'],
          }
        : config,
    )
}
