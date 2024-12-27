# @vue/eslint-config-typescript

ESLint configuration for Vue 3 + TypeScript projects.

See [@typescript-eslint/eslint-plugin](https://typescript-eslint.io/rules/) for available rules.

This config is specifically designed to be used by `create-vue` setups
and is not meant for outside use (it can be used but some adaptations
on the user side might be needed - for details see the config file).

A part of its design is that this config may implicitly depend on
other parts of `create-vue` setups, such as `eslint-plugin-vue` being
extended in the same resulting config.

> [!NOTE]
> The current version doesn't support the legacy `.eslintrc*` configuration format. For that you need to use version 13 or earlier. See the [corresponding README](https://www.npmjs.com/package/@vue/eslint-config-typescript/v/legacy-eslintrc) for more usage instructions.

## Installation

```sh
npm add --dev @vue/eslint-config-typescript
```

Please also make sure that you have `typescript` and `eslint` installed.

## Usage

Because of the complexity of this config, it is exported as a factory function that takes an options object and returns an ESLint configuration object.

This package exports:

- `defineConfigWithVueTs`, a utility function whose type signature is the same as the [`config` function from `typescript-eslint`](https://typescript-eslint.io/packages/typescript-eslint#config), but will modify the given config to work with Vue.js + TypeScript.
- `vueTsConfigs`, contains all the [shared configruations from `typescript-eslint`](https://typescript-eslint.io/users/configs) (in camelCase, e.g. `configs.recommendedTypeChecked`).
- a Vue-specific config factory: `configureVueProject({ scriptLangs, rootDir })`. More info below.

### Minimal Setup

```js
// eslint.config.mjs
import pluginVue from 'eslint-plugin-vue'
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
)
```

The above configuration enables [the essential rules for Vue 3](https://eslint.vuejs.org/rules/#priority-a-essential-error-prevention) and [the recommended rules for TypeScript](https://typescript-eslint.io/rules/?=recommended).

All the `<script>` blocks in `.vue` files *MUST* be written in TypeScript (should be either `<script setup lang="ts">` or `<script lang="ts">`).

### Advanced Setup

```js
// eslint.config.mjs
import pluginVue from 'eslint-plugin-vue'
import {
  defineConfigWithVueTs,
  vueTsConfigs,
  configureVueProject,
} from '@vue/eslint-config-typescript'

configureVueProject({
  // Optional: specify the script langs in `.vue` files
  // Defaults to `['ts']`.
  scriptLangs: [
    'ts',

    // [!DISCOURAGED]
    // Include 'js' to allow plain `<script>` or `<script setup>` blocks.
    // This might result-in false positive or negatives in some rules for `.vue` files.
    // Note you also need to configure `allowJs: true` and `checkJs: true`
    // in corresponding `tsconfig.json` files.
    'js',

    // [!STRONGLY DISCOURAGED]
    // Include 'tsx' to allow `<script lang="tsx">` blocks.
    // This would be in conflict with all type-aware rules.
    'tsx',

    // [!STRONGLY DISCOURAGED]
    // Include 'jsx' to allow `<script lang="jsx">` blocks.
    // This would be in conflict with all type-aware rules and may result in false positives.
    'jsx',
  ],

  // <https://github.com/vuejs/eslint-plugin-vue/issues/1910#issuecomment-1819993961>
  // Optional: the root directory to resolve the `.vue` files, defaults to `process.cwd()`.
  // You may need to set this to the root directory of your project if you have a monorepo.
  // This is useful when you allow any other languages than `ts` in `.vue` files.
  // Our config helper would resolve and parse all the `.vue` files under `rootDir`,
  // and only apply the loosened rules to the files that do need them.
  rootDir: import.meta.dirname,
})

export default defineConfigWithVueTs(
  pluginVue.configs["flat/essential"],

  // We STRONGLY RECOMMEND you to start with `recommended` or `recommendedTypeChecked`.
  // But if you are determined to configure all rules by yourself,
  // you can start with `base`, and then turn on/off the rules you need.
  vueTsConfigs.base,
)
```

### Linting with Type Information

Some `typescript-eslint` rules utilizes type information to provide deeper insights into your code.
But type-checking is a much slower process than linting with only syntax information.
It is not always easy to set up the type-checking environment for ESLint without severe performance penalties.

So we don't recommend you to configure individual type-aware rules and the corresponding language options all by yourself.
Instead, you can start by extending from the `recommendedTypeChecked` configuration and then turn on/off the rules you need.

```js
// eslint.config.mjs
import pluginVue from 'eslint-plugin-vue'
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked
)
```

## Further Reading

- [All the extendable configurations from `typescript-eslint`](https://typescript-eslint.io/users/configs).
- [All the available rules from `typescript-eslint`](https://typescript-eslint.io/rules/).

### With Other Community Configs

Work-In-Progress.

~~If you are following the [`standard`](https://standardjs.com/) or [`airbnb`](https://github.com/airbnb/javascript/) style guides, don't manually extend from this package. Please use `@vue/eslint-config-standard-with-typescript` or `@vue/eslint-config-airbnb-with-typescript` instead.~~
