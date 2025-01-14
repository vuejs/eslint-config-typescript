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

export class TsEslintConfigForVue {
  // the name property is here to provide better error messages when ESLint throws an error
  configName: ExtendableConfigName

  constructor(configName: ExtendableConfigName) {
    this.configName = configName
  }

  needsTypeChecking(): boolean {
    if (this.configName === 'disableTypeChecked') {
      return false
    }
    if (this.configName === 'all') {
      return true
    }
    return this.configName.includes('TypeChecked')
  }

  toConfigArray(): FlatConfig.ConfigArray {
    return toArray(tseslint.configs[this.configName])
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
}

export const vueTsConfigs = Object.fromEntries(
  CONFIG_NAMES.map(name => [
    name,
    new Proxy(new TsEslintConfigForVue(name), {
      // `ownKeys` is called by ESLint when validating the config object.
      // The only possible scenario where this is called is when the placeholder object
      // isn't replaced, which means it's passed to ESLint without being wrapped by
      // `defineConfigWithVueTs()`
      // We throw an error here to provide a better error message to the user.
      ownKeys() {
        throw new Error(
          'Please wrap the config object with `defineConfigWithVueTs()`',
        )
      },

      get(target, prop) {
        // for clearer error messages on where the config is coming from
        if (prop === 'name') {
          return `vueTsConfigs.${Reflect.get(target, 'configName')}`
        }

        return Reflect.get(target, prop)
      },
    }),
  ]),
) as Record<ExtendableConfigName, TsEslintConfigForVue>
