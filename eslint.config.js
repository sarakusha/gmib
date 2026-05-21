const js = require('@eslint/js');
const typescriptEslint = require('typescript-eslint');
const pluginReact = require('eslint-plugin-react');
const pluginReactHooks = require('eslint-plugin-react-hooks');
const pluginJsxA11y = require('eslint-plugin-jsx-a11y');
const pluginUnusedImports = require('eslint-plugin-unused-imports');
const pluginImport = require('eslint-plugin-import');
const configPrettier = require('eslint-config-prettier');

module.exports = [
  // Global ignores
  {
    ignores: [
      'packages/preload/exposedInMainWorld.d.ts',
      'packages/playerPreload/exposedInMainWorld.d.ts',
      'node_modules/**',
      '**/dist/**',
      'build/**',
      '**/*.md',
      '**/*.mdx',
      '.eslintignore',
      'packages/common/test.js',
    ],
  },

  // ESLint recommended config
  js.configs.recommended,

  // TypeScript ESLint base config (includes parser and plugin setup)
  ...typescriptEslint.configs.recommended,

  // Main configuration for all files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
      parser: typescriptEslint.parser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        project: './packages/**/tsconfig.json',
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
      'jsx-a11y': pluginJsxA11y,
      'unused-imports': pluginUnusedImports,
      import: pluginImport,
    },
    rules: {
      // ESLint base rules
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-param-reassign': [
        'error',
        { props: true, ignorePropertyModificationsFor: ['draft', 'state'] },
      ],
      'sort-imports': ['error', { ignoreDeclarationSort: true, ignoreCase: true }],

      // TypeScript ESLint rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-expressions': [2, { allowShortCircuit: true }],
      '@typescript-eslint/dot-notation': ['error', { allowIndexSignaturePropertyAccess: true }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Rules that don't exist or cause issues
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-invalid-void-type': 'off',
      '@typescript-eslint/unified-signatures': 'off',
      '@typescript-eslint/prefer-literal-enum-member': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'import/prefer-default-export': 'off',
      'import/no-extraneous-dependencies': 'off',
      'import/order': 'off',
      'import/no-absolute-path': 'off',
      'preserve-caught-error': 'off',

      // React & JSX rules
      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react/function-component-definition': 'off',
      'react/no-unknown-property': ['error', { ignore: ['css'] }],
      'react/destructuring-assignment': 'off',

      // JSX A11Y rules
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/media-has-caption': 'off',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Code style rules
      semi: ['error', 'always'],
      'comma-dangle': ['warn', 'always-multiline'],
      quotes: ['warn', 'single'],

      // Unused imports
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // Disable rules that conflict with prettier
      indent: 'off',
      'object-curly-spacing': 'off',
      'array-bracket-spacing': 'off',
      'space-before-function-paren': 'off',
    },
  },

  // Configuration for markdown and MDX files (without TypeScript project parsing)
  {
    files: ['**/*.{md,mdx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
    },
  },

  // Prettier config (disables conflicting rules)
  configPrettier,
];
