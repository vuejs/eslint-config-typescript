# @vue/eslint-config-typescript

> eslint-config-typescript for Vue

See [@typescript-eslint/eslint-plugin](https://typescript-eslint.io/rules/) for available rules.

This config is specifically designed to be used by `@vue/cli` & `create-vue` setups
and is not meant for outside use (it can be used but some adaptations
on the user side might be needed - for details see the config file).

A part of its design is that this config may implicitly depend on
other parts of `@vue/cli`/`create-vue` setups, such as `eslint-plugin-vue` being
extended in the same resulting config.

## Installation

In order to work around [a known limitation in ESLint](https://github.com/eslint/eslint/issues/3458), we recommend you to use this package alongside `@rushstack/eslint-patch`, so that you don't have to install too many dependencies:

```sh
npm add --dev @vue/eslint-config-typescript @rushstack/eslint-patch
```

## Usage

This plugin provides some predefined configs. You can use the following configs by adding them to extends.

- `@vue/eslint-config-typescript`: Aliased to the `recommended` config below.
- `@vue/eslint-config-typescript/base`: Settings and rules to enable correct ESLint parsing for Vue-TypeScript projects.
- `@vue/eslint-config-typescript/eslint-recommended`: `base` + `eslint:recommended` + turns off several conflicting rules in the `eslint:recommended` ruleset.
- `@vue/eslint-config-typescript/recommended`: The recommended rules for Vue-TypeScript projects, extended from `plugin:@typescript-eslint/recommended`.
- Additional configs that can be used *alongside* the abovementioned configs:
  - Additional recommended rules that require type information (does not support `no-unsafe-*` rules, though):
    - `@vue/eslint-config-typescript/recommended-requiring-type-checking`
  - Additional strict rules that can also catch bugs but are more opinionated than recommended rules (with experimental support for `no-unsafe-*` rules; note this config does not conform to semver, meaning breaking changes may be introduced during minor releases):
    - `@vue/eslint-config-typescript/strict`
  - Additional configs to allow `<script>` langs other than `lang="ts"` (NOT recommended):
    - `@vue/eslint-config-typescript/allow-js-in-vue`, allows plain `<script>` tags in `.vue` files.
    - `@vue/eslint-config-typescript/allow-tsx-in-vue`, allows `<script lang="tsx">` in `.vue` files; conflicts with `recommended-requiring-type-checking`.
    - `@vue/eslint-config-typescript/allow-jsx-in-vue`, allows plain `<script>`, `<script lang="jsx">`, and `<script lang="tsx">` tags in `.vue` files; conflicts with `recommended-requiring-type-checking`.

An example `.eslintrc.cjs`:

```js
require("@rushstack/eslint-patch/modern-module-resolution")

module.exports = {
  extends: [
    'plugin:vue/vue3-essential',
    '@vue/eslint-config-typescript'
    '@vue/eslint-config-typescript/recommended-requiring-type-checking'
  ]
}
```

## Migrating from v11.x

- If you extended from `@vue/eslint-config-typescript` in v11.x, you should now extend from `['@vue/eslint-config-typescript/eslint-recommended', '@vue/eslint-config-typescript/allow-jsx-in-vue']` instead.
- If you extended from `@vue/eslint-config-typescript/recommended` in v11.x, you should now extend from `['@vue/eslint-config-typescript', '@vue/eslint-config-typescript/allow-jsx-in-vue']` instead.
- But if you don't have any plain `<script>`, `<script lang="tsx">`, or `<script lang="jsx">` in your `.vue` files, you can omit `@vue/eslint-config-typescript/allow-jsx-in-vue` from the extends array.

## TypeScript Support for Other Community Style Guides

If you are following the [`standard`](https://standardjs.com/) or [`airbnb`](https://github.com/airbnb/javascript/) style guides, don't manually extend from this package. Please use [`@vue/eslint-config-standard-with-typescript`](https://www.npmjs.com/package/@vue/eslint-config-standard-with-typescript) or [`@vue/eslint-config-airbnb-with-typescript`](https://www.npmjs.com/package/@vue/eslint-config-airbnb-with-typescript) instead.

## Non-Conventional TSConfig Locations

By default, this ruleset searches for TSConfig files matching `**/tsconfig.json` and `**/tsconfig.*.json` from the current working directory.
This should cover most use cases.

However, if your TSConfig file is located somewhere else (e.g., in an ancestor directory), or doesn't follow the conventional naming (e.g., named as `my-custom-tsconfig.json`), you need to specify the location in your `.eslintrc.cjs` manually:

```js
require("@rushstack/eslint-patch/modern-module-resolution")
const createAliasSetting = require('@vue/eslint-config-typescript/createAliasSetting')

module.exports = {
  root: true,
  extens: [
    'plugin:vue/vue3-essential',
    '@vue/eslint-config-typescript'
  ],
  parserOptions: {
    project: ['/path/to/my-custom-tsconfig.json']
  },
  settings: {
    ...createAliasSetting(['/path/to/my-custom-tsconfig.json'])
  }
}
```

## `Parsing error: "parserOptions.project" has been set for @typescript-eslint/parser.`

If you are using this config in an existing project, you may encounter this error:

```text
Parsing error: "parserOptions.project" has been set for @typescript-eslint/parser.
The file does not match your project config: foo.js.
The file must be included in at least one of the projects provided
```

It is likely because your existing `tsconfig.json` does not include all of the files you would like to lint.

(This doesn't usually happen in projects created by [`create-vue`](https://github.com/vuejs/create-vue) because it creates projects with [solution-style `tsconfig.json` files](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html#support-for-solution-style-tsconfigjson-files) that cover every file in the project.)

A workaround is to create a separate `tsconfig.eslint.json` as follows:

```json
{
  // Extend your base config so you don't have to redefine your compilerOptions
  "extends": "./tsconfig.json",
  "include": [
    // Include all files in the project
    "./**/*",
    // By default the `include` glob pattern doesn't match `.vue` files, so we add it explicitly
    "./**/*.vue"
  ],
  "compilerOptions": {
    // Include `.js` & `.jsx` extensions
    "allowJs": true
  }
}
```

## Further Improvements

- Support [ESLint Flag Config](https://eslint.org/docs/latest/user-guide/configuring/configuration-files-new).
- Keep an eye on [`@volar-plugins/eslint`](https://github.com/johnsoncodehk/volar/discussions/2204) for potentially better TypeScript integrations.
