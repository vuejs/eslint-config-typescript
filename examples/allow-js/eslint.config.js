import pluginVue from "eslint-plugin-vue";
import vueTsEslintConfig from "@vue/eslint-config-typescript";

export default [
  ...pluginVue.configs["flat/essential"],
  ...vueTsEslintConfig({
    supportedScriptLangs: {
      ts: true,
      js: true
    }
  }),
]
