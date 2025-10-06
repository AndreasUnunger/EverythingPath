import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfig(
  [
    globalIgnores([
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ]),
  ],
  {
    name: 'defaultconfig',
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      'next/core-web-vitals',
      'next/typescript',
      'prettier',
      'tseslint.configs.recommended',
      'tseslint.configs.recommendedTypeChecked',
      'tseslint.configs.stylisticTypeChecked',
      eslintConfigPrettier,
    ],
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
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      ...eslintConfigPrettier.rules,
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
      noInlineConfig: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
