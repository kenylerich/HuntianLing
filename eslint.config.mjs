import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

export default defineConfig([
  { ignores: ['vendor/**', 'lib/**', 'node_modules/**', 'output/**', 'coverage/**', '.pnpm-store/**'] },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ts.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'test/**/*.mjs', 'eslint.config.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  },
]);
