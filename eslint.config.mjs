import { defineConfig, globalIgnores } from 'eslint/config';
import pluginQuery from '@tanstack/eslint-plugin-query';
import eslintConfigPrettier from 'eslint-config-prettier';
import convexPlugin from '@convex-dev/eslint-plugin';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig([
  globalIgnores([
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'convex/_generated/**',
    // Agent worktrees and local scratch files are not part of the project.
    '.claude/**',
    '.scratch/**',
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
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
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
    name: 'react-hooks',
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/set-state-in-effect': 'error',
    },
  },
  {
    name: 'test-files',
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      'vitest.config.ts',
      'vitest.setup.ts',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
      noInlineConfig: true,
    },
  },
  ...convexPlugin.configs.recommended,
  ...pluginQuery.configs['flat/recommended'],
]);
