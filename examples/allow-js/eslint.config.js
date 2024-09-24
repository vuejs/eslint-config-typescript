import pluginVue from "eslint-plugin-vue";
import vueTsEslintConfig from "@vue/eslint-config-typescript";

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.js', '**/*.mjs', '**/*.ts', '**/*.mts', '**/*.vue'],
    ignores: ['**/dist/**'],
  },

  ...pluginVue.configs["flat/essential"],
  ...vueTsEslintConfig({
    supportedScriptLangs: {
      ts: true,
      js: true
    }
  }),
]
