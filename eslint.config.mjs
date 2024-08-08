import eslint from '@eslint/js';
import vue from 'eslint-plugin-vue';
import recommended from './recommended.mjs';
import tseslint from "typescript-eslint";
import globals from "globals"

export default tseslint.config(...vue.configs["flat/essential"], eslint.configs.recommended, ...recommended, {
    languageOptions: {
        globals: globals.browser,
    }
}, {
    files: ['test/**.spec.js'],
    languageOptions: {
        globals: globals.jest,
    },
    rules: {
        '@typescript-eslint/no-var-requires': 'off'
    }
});