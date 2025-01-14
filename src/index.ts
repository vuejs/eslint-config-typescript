export {
  defineConfigWithVueTs,
  configureVueProject,
} from './utilities'
export { vueTsConfigs } from './configs'

// Compatibility layer for the `createConfig` function in <= 14.2.0
export { default as createConfig } from './createConfig'
export { default } from './createConfig'

import { defineConfigWithVueTs } from './utilities'
// Somehow re-export can't preserve the deprecated comment to the generated d.ts file
/**
 * @deprecated `defineConfig` is renamed to `defineConfigWithVueTs` in 14.3.0
 */
export const defineConfig = defineConfigWithVueTs
