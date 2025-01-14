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
  constructor(readonly configName: ExtendableConfigName) {
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
  CONFIG_NAMES.map(name => [name, new TsEslintConfigForVue(name)]),
) as Record<ExtendableConfigName, TsEslintConfigForVue>