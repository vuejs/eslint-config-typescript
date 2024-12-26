import tseslint from 'typescript-eslint'

import type { FlatConfig } from '@typescript-eslint/utils/ts-eslint'

const PlaceholderPrefix =
  'PLACEHOLDER_THAT_MUST_BE_WRAPPED_INSIDE_defineConfig_'

// Manually declare all the available configs as enums to make the auto-completion more user-friendly.
// It's also a good way to avoid the placeholder strings to appear in the auto-completion.
export enum VueTsPreset {
  all = `${PlaceholderPrefix}all`,
  base = `${PlaceholderPrefix}base`,
  disableTypeChecked = `${PlaceholderPrefix}disableTypeChecked`,
  eslintRecommended = `${PlaceholderPrefix}eslintRecommended`,
  recommended = `${PlaceholderPrefix}recommended`,
  recommendedTypeChecked = `${PlaceholderPrefix}recommendedTypeChecked`,
  recommendedTypeCheckedOnly = `${PlaceholderPrefix}recommendedTypeCheckedOnly`,
  strict = `${PlaceholderPrefix}strict`,
  strictTypeChecked = `${PlaceholderPrefix}strictTypeChecked`,
  strictTypeCheckedOnly = `${PlaceholderPrefix}strictTypeCheckedOnly`,
  stylistic = `${PlaceholderPrefix}stylistic`,
  stylisticTypeChecked = `${PlaceholderPrefix}stylisticTypeChecked`,
  stylisticTypeCheckedOnly = `${PlaceholderPrefix}stylisticTypeCheckedOnly`,
}

// `enum`s are just objects with reverse mapping during runtime.
// We redefine the type here only to make the auto-completion more user-friendly.
export type ExtendableConfigName = keyof typeof VueTsPreset
export const configs = VueTsPreset as {
  [key in ExtendableConfigName]: VueTsPreset
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export function getConfigForPlaceholder(
  placeholder: VueTsPreset,
): FlatConfig.ConfigArray {
  return toArray(
    tseslint.configs[
      placeholder.replace(
        new RegExp(`^${PlaceholderPrefix}`),
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
