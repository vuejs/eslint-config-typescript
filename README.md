# @vue/eslint-config-typescript

ESLint configuration for Vue 3 + TypeScript projects.

See [@typescript-eslint/eslint-plugin](https://typescript-eslint.io/rules/) for available rules.

This config is designed for `create-vue` setups.
Other projects can use it, but may need project-specific adjustments.

It may rely on other `create-vue` defaults, such as `eslint-plugin-vue`
being extended in the same final config.

> [!NOTE]
> The current version doesn't support the legacy `.eslintrc*` configuration format. Use version 13 or earlier for that format. See the [corresponding README](https://www.npmjs.com/package/@vue/eslint-config-typescript/v/legacy-eslintrc) for more usage instructions.

## Installation

```sh
npm add --dev @vue/eslint-config-typescript
```

Please also make sure that you have `typescript` and `eslint` installed.

## Usage

For new flat configs, use these two exports:

- `withVueTs`, a helper that builds a flat ESLint config for Vue.js + TypeScript. It accepts either `withVueTs(...configs)` or `withVueTs(options, ...configs)`.
- `vueTsConfigs`, the [shared configurations from `typescript-eslint`](https://typescript-eslint.io/users/configs) adapted for `.vue` files in addition to TypeScript files. The names are in camel case, such as `vueTsConfigs.recommendedTypeChecked`.

The helper APIs used before v14.9 remain available for existing projects. See [Helper APIs Before v14.9](#helper-apis-before-v149).

### Recommended

`withVueTs(...)` is available in v14.9 and later. Export the `withVueTs(...)` call from `eslint.config.js`, `eslint.config.mjs`, or `eslint.config.ts`.

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

`withVueTs(...)` accepts config objects, config arrays, and promises. This matches the input style used by [`eslint-flat-config-utils`](https://github.com/antfu/eslint-flat-config-utils), so configs built with Antfu's or Nuxt's ESLint config utilities can be passed to `withVueTs(...)` for Vue + TypeScript resolution.

### Linting with Type Information

Some `typescript-eslint` rules use type information to provide deeper insights into the project code.
Type-checking is much slower than linting with syntax information only.
Setting up typed linting for ESLint without severe performance penalties can be difficult.

We don't recommend configuring individual type-aware rules and the corresponding language options manually.
Start with the `recommendedTypeChecked` configuration, then turn rules on or off as needed.

```js
// eslint.config.mjs
import pluginVue from 'eslint-plugin-vue'
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default withVueTs(
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked,
)
```

### Project Options

`withVueTs(...)` accepts options for this config as the first argument. These are the same options accepted by `configureVueProject(...)` in the helper APIs before v14.9.

Only pass the options that differ from the defaults. This example lists all available options:

```js
// eslint.config.mjs
import pluginVue from 'eslint-plugin-vue'
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default withVueTs(
  {
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
      // 'js',

      // [!STRONGLY DISCOURAGED]
      // Include 'tsx' to allow `<script lang="tsx">` blocks.
      // This would be in conflict with all type-aware rules.
      // 'tsx',

      // [!STRONGLY DISCOURAGED]
      // Include 'jsx' to allow `<script lang="jsx">` blocks.
      // This would be in conflict with all type-aware rules and may result in false positives.
      // 'jsx',
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
  },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked,
)
```

### Helper APIs Before v14.9

Configs written before v14.9 usually use `defineConfigWithVueTs(...)` as the final config helper, with `configureVueProject(...)` for the same project options.

Both APIs remain supported. `defineConfigWithVueTs(...)` accepts flat config entries and applies the final Vue + TypeScript resolution. `configureVueProject(...)` sets the project options used by `defineConfigWithVueTs(...)`.

The pre-v14.9 API shape:

```js
configureVueProject(options)
export default defineConfigWithVueTs(...configs)
```

maps to:

```js
export default withVueTs(options, ...configs)
```

```js
// eslint.config.mjs
import pluginVue from 'eslint-plugin-vue'
import {
  defineConfigWithVueTs,
  vueTsConfigs,
  configureVueProject,
} from '@vue/eslint-config-typescript'

configureVueProject({
  rootDir: import.meta.dirname,
  scriptLangs: ['ts', 'js'],
})

export default defineConfigWithVueTs(
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
)
```

### Migration

To migrate an existing flat config from `defineConfigWithVueTs(...)` / `configureVueProject(...)` to `withVueTs(...)`, use:

```sh
npx @vue/eslint-config-typescript migrate-to-with-vue-ts
```

This command is interactive by default. It discovers `eslint.config.{js,mjs,ts,mts}`, shows the planned changes, and asks before writing files.

The codemod is conservative. It auto-fixes common top-level helper patterns, and reports unusual cases such as non-top-level `configureVueProject(...)` calls or ambiguous first arguments for manual migration.

Explicit paths and non-interactive runs are also supported:

```sh
npx @vue/eslint-config-typescript migrate-to-with-vue-ts eslint.config.ts
npx @vue/eslint-config-typescript migrate-to-with-vue-ts "packages/*/eslint.config.ts" --yes
```

There is also a versioned alias:

```sh
npx @vue/eslint-config-typescript migrate-14.9
```

Use `migrate-to-with-vue-ts` as the primary interface. The alias is only a convenience for this specific migration and future releases may add other migrations.

## Use As a Normal Shared ESLint Config (Not Recommended)

This package can be used as a normal ESLint config, without `withVueTs` or `defineConfigWithVueTs`. In that setup, overriding the rules for `.vue` files is more difficult and comes with many nuances. Use this mode with caution.

See [the documentation for 14.1 and earlier versions](https://github.com/vuejs/eslint-config-typescript/tree/v14.1.4#usage) for more information.

## Further Reading

- [All the extendable configurations from `typescript-eslint`](https://typescript-eslint.io/users/configs).
- [All the available rules from `typescript-eslint`](https://typescript-eslint.io/rules/).
