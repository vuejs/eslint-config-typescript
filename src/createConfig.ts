// This is a compatibility layer for the `createConfig` function in <= 14.2.0
// Will be removed in 15.0.0

import tseslint from 'typescript-eslint'
import type { FlatConfig } from '@typescript-eslint/utils/ts-eslint'

import {
  configureVueProject,
  defineConfigWithVueTs,
  type ProjectOptions,
} from './utilities'
import { vueTsConfigs, type ExtendableConfigName } from './configs'
import type { ScriptLang } from './internals'

type ConfigOptions = ProjectOptions & {
  extends?: ExtendableConfigName[]
  supportedScriptLangs?: Record<ScriptLang, boolean>
}

/**
 * @deprecated Use `defineConfigWithVueTs` + `vueTsConfigs` instead.
 */
export default function createConfig({
  extends: configNamesToExtend = ['recommended'],
  supportedScriptLangs = { ts: true, tsx: false, js: false, jsx: false },
  rootDir = process.cwd(),
}: ConfigOptions = {}): FlatConfig.ConfigArray {
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

  configureVueProject({
    scriptLangs: Object.keys(supportedScriptLangs).filter(
      lang => supportedScriptLangs[lang as ScriptLang],
    ) as ScriptLang[],
    rootDir,
  })
  return defineConfigWithVueTs(
    ...configNamesToExtend.map(
      name => vueTsConfigs[name as ExtendableConfigName],
    ),
  )
}
