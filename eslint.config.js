// eslint.config.js
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

import baseConfig from './eslint.config.mjs';

export default [
  ...baseConfig,

  {
    ignores: [
      'src/core/tests/**',
      'vitest.config.ts',
      'vitest.config.js',
      'dist/**',
    ],
  },

  {
    settings: {
      'import-x/resolver': {
        typescript: { project: './tsconfig.json' },
      },
      react: { version: 'detect' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
  },

  // Plain JS/TS, no JSX
  {
    files: ['src/**/*.{js,ts}'],
    ignores: ['**/*.tsx', '**/*.jsx'],
    rules: {
      '@stylistic/indent': ['error', 4],
    },
  },

  // TSX/JSX: combine stylistic indent for TS code with React rules for JSX
  {
    files: ['src/**/*.{tsx,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Enforce 4 spaces in TypeScript parts of TSX, but ignore JSX to avoid the recursion bug
      '@stylistic/indent': ['error', 4, {
        ignoredNodes: [
          'JSXElement',
          'JSXElement *',
          'JSXFragment',
          'JSXFragment *',
          'JSXOpeningElement',
          'JSXClosingElement',
          'JSXAttribute',
          'JSXSpreadAttribute',
          'JSXText',
          'JSXExpressionContainer',
        ],
      }],
      'react/jsx-indent': ['error', 4],
      'react/jsx-indent-props': ['error', 4],

      'import-x/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'always', jsx: 'always', ts: 'never', tsx: 'never',
        },
      ],
      'import-x/no-useless-path-segments': ['error', { noUselessIndex: false }],

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  {
    files: ['src/tui.ts'],
    rules: { 'n/no-process-exit': 'off' },
  },
];
