import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
    { ignores: ['dist', 'node_modules'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.{ts,tsx}', 'vite.config.ts'],
        languageOptions: {
            globals: globals.browser,
        },
        plugins: { 'react-hooks': reactHooks },
        rules: {
            // Parity with the CRA react-app preset: classic Hooks rules only.
            // react-hooks v7's "recommended" set also enables experimental
            // compiler-driven rules that would require app-behavior refactors.
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
        },
    },
    {
        files: ['vite.config.ts'],
        languageOptions: { globals: globals.node },
    },
);
