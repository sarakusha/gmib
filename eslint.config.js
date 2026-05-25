const js = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const globals = require('globals');
const typescriptEslint = require('typescript-eslint');
const configPrettier = require('eslint-config-prettier');

module.exports = (async () => {
  const react = (await import('@eslint-react/eslint-plugin')).default;

  return defineConfig(
    {
      ignores: [
        'node_modules/**',
        '**/dist/**',
        'build/**',
        '**/*.md',
        '**/*.mdx',
        'packages/common/test.js',
        'packages/preload/*InMainWorld.d.ts',
        '**/vite.config.js',
      ],
    },

    js.configs.recommended,
    ...typescriptEslint.configs.recommendedTypeChecked,

    {
      files: ['**/*.{js,jsx,ts,tsx}'],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: {
          ...globals.browser,
          ...globals.node,
        },
        parserOptions: {
          projectService: true,
          tsconfigRootDir: __dirname,
        },
      },
      rules: {
        'no-console': ['error', { allow: ['warn', 'error'] }],
        'no-param-reassign': [
          'error',
          { props: true, ignorePropertyModificationsFor: ['draft', 'state'] },
        ],
        'sort-imports': ['error', { ignoreDeclarationSort: true, ignoreCase: true }],

        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/dot-notation': ['error', { allowIndexSignaturePropertyAccess: true }],
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-invalid-void-type': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true }],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
        '@typescript-eslint/restrict-template-expressions': 'off',
        '@typescript-eslint/unbound-method': 'off',

        semi: ['error', 'always'],
        'comma-dangle': ['warn', 'always-multiline'],
        quotes: ['warn', 'single'],
        'preserve-caught-error': 'off',
      },
    },

    {
      files: ['**/*.{jsx,tsx}'],
      plugins: {
        '@eslint-react': react,
      },
      rules: {
        '@eslint-react/dom-no-unknown-property': ['error', { ignore: ['css'] }],
        '@eslint-react/exhaustive-deps': 'warn',
        '@eslint-react/rules-of-hooks': 'error',
      },
    },

    configPrettier,
  );
})();
