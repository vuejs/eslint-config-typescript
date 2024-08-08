import tseslint from "typescript-eslint";

export default tseslint.config(tseslint.configs.eslintRecommended, {
    plugins: {
        '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
        parserOptions: {
            parser: {
                'ts': tseslint.parser,
                'tsx': tseslint.parser,
                'cts': tseslint.parser,
                'mts': tseslint.parser,
            },
            extraFileExtensions: ['.vue'],
            ecmaFeatures: {
                jsx: true,
            }
        }
    },

}, {
    files: ['*.ts', '*.cts', '*.mts', '*.tsx', '*.vue'],
    rules: {
        // The core 'no-unused-vars' rules (in the eslint:recommeded ruleset)
        // does not work with type definitions
        'no-unused-vars': 'off',
        // TS already checks for that, and Typescript-Eslint recommends to disable it
        // https://typescript-eslint.io/linting/troubleshooting#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
        'no-undef': 'off',
        '@typescript-eslint/no-unused-vars': 'warn'
    }
});