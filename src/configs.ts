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

/**
 * The options that a config in the `extends` should inherit.
 */
type ExtendsOptions = {
  name?: string
  files?: (string | string[])[]
  ignores?: string[]
}

export class TsEslintConfigForVue {
  /**
   * The name of the config object as defined in `typescript-eslint`.
   */
  configName: ExtendableConfigName

  /**
   * the name property is here to provide better error messages when ESLint throws an error
   */
  name: string

  constructor(configName: ExtendableConfigName) {
    this.configName = configName
    this.name = `vueTsConfigs.${configName}`
  }

  extendsOptions?: ExtendsOptions
  /**
   * Create a new instance of `TsEslintConfigForVue` with the `restOfConfig` merged into it.
   * Should be used when the config is used in the `extends` field of another config.
   */
  asExtendedWith(restOfConfig: ExtendsOptions): TsEslintConfigForVue {
    const extendedConfig = new TsEslintConfigForVue(this.configName)

    extendedConfig.extendsOptions = {
      name: [restOfConfig.name, this.name].filter(Boolean).join('__'),
      ...(restOfConfig.files && { files: restOfConfig.files }),
      ...(restOfConfig.ignores && { ignores: restOfConfig.ignores }),
    }

    return extendedConfig
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
      .map((config: FlatConfig.Config) => ({
        ...config,
        ...(config.files && config.files.includes('**/*.ts')
          ? { files: [...config.files, '**/*.vue'] }
          : {}),
        ...this.extendsOptions,
      }))
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
    }),
  ]),
) as Record<ExtendableConfigName, TsEslintConfigForVue>
