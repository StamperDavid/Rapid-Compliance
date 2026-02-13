/**
 * ESLint 9 Flat Configuration
 *
 * HARD BLOCKING MODE - The Legacy Zone is CLOSED
 * All rules are ERRORS. No warnings. No bypass. No exceptions.
 */

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default tseslint.config(
  // ==========================================================================
  // GLOBAL IGNORES
  // ==========================================================================
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'public/**',
      'coverage/**',
      // Config files
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
      '.eslintrc.js',
      'next.config.js',
      'postcss.config.js',
      'tailwind.config.ts',
      'tsconfig.eslint.json',
      // Temporary fix scripts
      'comprehensive-ecommerce-fix.js',
      'final-ecommerce-fix.js',
      'fix-ecommerce-eslint.js',
      'fix-unused-vars.js',
      'fix-workflows-temp.js',
      'ultra-final-fix.js',
      // Jest config files
      'jest.config.js',
      'jest.setup.js',
      'jest.globalTeardown.js',
      // All scripts folder files (not type-checked, outside tsconfig scope)
      'scripts/**/*.js',
      'scripts/**/*.ts',
    ],
  },

  // ==========================================================================
  // BASE JS CONFIG (for all files)
  // ==========================================================================
  js.configs.recommended,

  // ==========================================================================
  // PRETTIER COMPAT
  // ==========================================================================
  ...compat.extends('eslint-config-prettier'),

  // ==========================================================================
  // TYPESCRIPT FILES - STRICT TYPE-CHECKED
  // ==========================================================================
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@next/next': nextPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // =========================================================================
      // HARD BLOCKING MODE - STRICT ENFORCEMENT
      // =========================================================================

      // TypeScript - STRICT ENFORCEMENT
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: false,
        },
      ],

      // Type-safety rules - STRICT ENFORCEMENT
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      // Disabled: Too strict for dynamic data handling
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      // Disabled: Too strict for callback patterns
      '@typescript-eslint/unbound-method': 'off',
      // Disabled: Allows rethrowing any value
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',

      // React Best Practices - STRICT ENFORCEMENT
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react/no-unescaped-entities': 'error',
      'react/display-name': 'off',

      // Next.js Best Practices - STRICT ENFORCEMENT
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-img-element': 'error',

      // General Code Quality - STRICT ENFORCEMENT
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'all'],
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],

      // Import organization - STRICT ENFORCEMENT
      'no-duplicate-imports': 'error',

      // Best practices for async/await - STRICT ENFORCEMENT
      'require-atomic-updates': 'error',
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',

      // Prevent common bugs - STRICT ENFORCEMENT
      'no-constant-binary-expression': 'error',
      'no-unreachable': 'error',
      'no-unreachable-loop': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'array-callback-return': 'error',
    },
  },

  // ==========================================================================
  // TEST FILES - RELAXED RULES
  // ==========================================================================
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'no-console': 'off',
    },
  },

  // ==========================================================================
  // SCRIPTS (TypeScript) - RELAXED CONSOLE
  // ==========================================================================
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
