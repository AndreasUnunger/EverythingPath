import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';

export default defineConfig(
  [
    globalIgnores([
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'convex/_generated/**',
    ]),
    {
      name: 'defaultconfig',
      files: ['**/*.ts', '**/*.tsx'],
      extends: [
        ...tseslint.configs.recommended,
        ...tseslint.configs.recommendedTypeChecked,
        ...tseslint.configs.stylisticTypeChecked,
        eslintConfigPrettier,
      ],
      plugins: {
        '@next/next': nextPlugin,
        react: react,
      },
      rules: {
        'no-console': 'error',
        'react/no-array-index-key': 'error',
        '@typescript-eslint/array-type': 'off',
        '@typescript-eslint/consistent-type-definitions': 'off',
        '@typescript-eslint/consistent-type-imports': [
          'warn',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/no-misused-promises': [
          'error',
          { checksVoidReturn: { attributes: false } },
        ],
        ...eslintConfigPrettier.rules,
        // Rules from next/core-web-vitals and next/typescript
        '@next/next/no-html-link-for-pages': 'off', // Example, adjust as needed
        // Add other Next.js specific rules here if needed
      },
      languageOptions: {
        parserOptions: {
          projectService: true,
        },
      },
    },
    {
      linterOptions: {
        reportUnusedDisableDirectives: 'warn',
        noInlineConfig: true,
      },
    },
  ],
);

