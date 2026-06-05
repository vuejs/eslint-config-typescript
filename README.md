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

Starting in v14.9, `withVueTs` is the recommended way to compose this package with other flat configs. It returns a Promise, so you can export it directly from `eslint.config.js` / `eslint.config.mjs` / `eslint.config.ts`.

The previous helpers remain available for backward compatibility and existing projects, but new setups should prefer `withVueTs`.

This package exports:

- `withVueTs`, a promise-driven utility for building a flat ESLint config that works with Vue.js + TypeScript. It accepts either `withVueTs(...configs)` or `withVueTs(options, ...configs)`, and also works with the result of `defineConfig()` from `eslint/config`.
- `vueTsConfigs`, contains all the [shared configurations from `typescript-eslint`](https://typescript-eslint.io/users/configs) (in camelCase, e.g. `vueTsConfigs.recommendedTypeChecked`), and applies to `.vue` files in addition to TypeScript files.
- `defineConfigWithVueTs`, the previous helper API. It is still supported, but new configs should prefer `withVueTs`.
- `configureVueProject({ scriptLangs, rootDir, includeDotFolders, ... })`, the previous project-wide configuration API. In new configs, prefer passing the same options as the first argument to `withVueTs(...)`.

### Recommended in v14.9+

```js
// eslint.config.mjs
import pluginVue from 'eslint-plugin-vue'
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default withVueTs(
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
)
```

The above configuration enables [the essential rules for Vue 3](https://eslint.vuejs.org/rules/#priority-a-essential-error-prevention) and [the recommended rules for TypeScript](https://typescript-eslint.io/rules/?=recommended).

All the `<script>` blocks in `.vue` files _MUST_ be written in TypeScript (should be either `<script setup lang="ts">` or `<script lang="ts">`).

If you need Vue-specific options such as `rootDir`, `includeDotFolders`, `scriptLangs`, `tsSyntaxInTemplates`, or `allowComponentTypeUnsafety`, pass them as the first argument:

```js
export default withVueTs(
  {
    rootDir: import.meta.dirname,
    includeDotFolders: false,
    scriptLangs: ['ts', 'js'],
  },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked,
)
```

> [!NOTE]
> If you prefer to compose with ESLint's built-in `defineConfig()` helper from `eslint/config`, that helper is available in ESLint 9.22.0 and later:
>
> ```js
> import { defineConfig } from 'eslint/config'
> import pluginVue from 'eslint-plugin-vue'
> import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
>
> export default withVueTs(
>   defineConfig(pluginVue.configs['flat/essential'], vueTsConfigs.recommended),
> )
> ```

### Linting with Type Information

Some `typescript-eslint` rules utilize type information to provide deeper insights into your code.
But type-checking is a much slower process than linting with only syntax information.
It is not always easy to set up the type-checking environment for ESLint without severe performance penalties.

So we don't recommend you to configure individual type-aware rules and the corresponding language options all by yourself.
Instead, you can start by extending from the `recommendedTypeChecked` configuration and then turn on/off the rules you need.

```js
// eslint.config.mjs
import pluginVue from 'eslint-plugin-vue'
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default withVueTs(
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked,
)
```

### Previous APIs

`defineConfigWithVueTs` and `configureVueProject` remain supported for existing setups. If you already use them, you do not need to migrate immediately. For new configs, prefer `withVueTs(...)`.

Most uses of `configureVueProject(...)` can now be expressed by passing the same options as the first argument to `withVueTs(...)`.

### Migration

If you want to migrate an existing flat config from `defineConfigWithVueTs(...)` / `configureVueProject(...)` to `withVueTs(...)`, the primary migration interface is:

```sh
npx @vue/eslint-config-typescript migrate-to-with-vue-ts
```

This command is interactive by default. It discovers `eslint.config.{js,mjs,ts,mts}`, shows the planned changes, and asks before writing files.

The codemod is intentionally conservative. It auto-fixes the common top-level helper patterns, and reports unusual cases such as non-top-level `configureVueProject(...)` calls or ambiguous first arguments for manual migration instead of guessing.

You can also pass explicit paths or skip the prompt:

```sh
npx @vue/eslint-config-typescript migrate-to-with-vue-ts eslint.config.ts
npx @vue/eslint-config-typescript migrate-to-with-vue-ts "packages/*/eslint.config.ts" --yes
```

There is also a versioned alias:

```sh
npx @vue/eslint-config-typescript migrate-14.9
```

But `migrate-to-with-vue-ts` should be treated as the primary interface. The alias is only a convenience for this specific migration and future releases may add other migrations.

```js
// eslint.config.mjs
import pluginVue from 'eslint-plugin-vue'
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  pluginVue.configs['flat/essential'],

  // We STRONGLY RECOMMEND you to start with `recommended` or `recommendedTypeChecked`.
  // But if you are determined to configure all rules by yourself,
  // you can start with `base`, and then turn on/off the rules you need.
  vueTsConfigs.base,
)
```

You can still configure the project globally when you need to keep the previous API shape:

```js
import { configureVueProject } from '@vue/eslint-config-typescript'

configureVueProject({
  tsSyntaxInTemplates: true,
  scriptLangs: ['ts', 'js'],
  allowComponentTypeUnsafety: true,
  rootDir: import.meta.dirname,
  includeDotFolders: false,
})
```

### Detailed Legacy Example

```js
// eslint.config.mjs
import pluginVue from 'eslint-plugin-vue'
import {
  defineConfigWithVueTs,
  vueTsConfigs,
  configureVueProject,
} from '@vue/eslint-config-typescript'

// Optional: configure the Vue project to adjust the strictness of the rulesets or speed up linting.
configureVueProject({
  // Whether to parse TypeScript syntax in Vue templates.
  // Defaults to `true`.
  // Setting it to `false` could improve performance.
  // But TypeScript syntax in Vue templates will then lead to syntax errors.
  // Also, type-aware rules won't be applied to expressions in templates in that case.
  tsSyntaxInTemplates: true,

  // Specify the script langs in `.vue` files
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

  // Whether to override some `no-unsafe-*` rules to avoid false positives on Vue component operations.
  // Defaults to `true`.
  // Usually you should keep this enabled,
  // but if you're using a metaframework or in a TSX-only project
  // where you're certain you won't operate on `.vue` components in a way that violates the rules,
  // and you want the strictest rules (e.g. when extending from `strictTypeChecked`),
  // you can set this to `false` to ensure the strictest rules apply to all files.
  allowComponentTypeUnsafety: true,

  // The root directory to resolve the `.vue` files.
  // Defaults to `process.cwd()`.
  // More info: <https://github.com/vuejs/eslint-plugin-vue/issues/1910#issuecomment-1819993961>
  // You may need to set this to the root directory of your project if you have a monorepo.
  // This is useful when you allow any other languages than `ts` in `.vue` files.
  // Our config helper would resolve and parse all the `.vue` files under `rootDir`,
  // and only apply the loosened rules to the files that do need them.
  rootDir: import.meta.dirname,

  // Whether to include dot folders when resolving `.vue` files under `rootDir`.
  // Defaults to `false`.
  // You may need to set this to `true` if your project stores Vue components
  // under folders such as `.vitepress`.
  includeDotFolders: false,
})

export default defineConfigWithVueTs(
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked,
)
```

## Use As a Normal Shared ESLint Config (Not Recommended)

You can use this package as a normal ESLint config, without `withVueTs` or `defineConfigWithVueTs`. But in this case, overriding the rules for `.vue` files would be more difficult and comes with many nuances. Please be cautious.

You can check [the documentation for 14.1 and earlier versions](https://github.com/vuejs/eslint-config-typescript/tree/v14.1.4#usage) for more information.

## Further Reading

- [All the extendable configurations from `typescript-eslint`](https://typescript-eslint.io/users/configs).
- [All the available rules from `typescript-eslint`](https://typescript-eslint.io/rules/).

### With Other Community Configs

- For [JavaScript Standard Style](https://standardjs.com/), use [`@vue/eslint-config-standard-with-typescript`](https://github.com/vuejs/eslint-config-standard/tree/main/packages/eslint-config-standard-with-typescript#usage)
- Airbnb JavaScript Style Guide support is still in progress.
