module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
    browser: false,
  },
  extends: [
    'airbnb',
    'airbnb-typescript',
    'eslint:recommended',
    'plugin:react-hooks/recommended',
    /** @see https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/eslint-plugin#recommended-configs */
    'plugin:@typescript-eslint/recommended',
    'plugin:mdx/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
    // project: './tsconfig-settings.json',
    project: './packages/**/tsconfig.json',
  },
  plugins: ['import', '@typescript-eslint', 'prettier', 'react-hooks', 'unused-imports'],
  ignorePatterns: [
    'packages/preload/exposedInMainWorld.d.ts',
    'packages/playerPreload/exposedInMainWorld.d.ts',
    'node_modules/**',
    '**/dist/**',
  ],
  rules: {
    'jsx-a11y/media-has-caption': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/consistent-type-imports': 'error',
    'import/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
    'sort-imports': ['error', { ignoreDeclarationSort: true, ignoreCase: true }],
    'import/no-absolute-path': 'off',
    '@typescript-eslint/no-unused-expressions': [2, { allowShortCircuit: true }],
    '@typescript-eslint/dot-notation': ['error', { allowIndexSignaturePropertyAccess: true }],
    'no-param-reassign': [
      'error',
      { props: true, ignorePropertyModificationsFor: ['draft', 'state'] },
    ],
    'react/prop-types': 'off',
    'react/require-default-props': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/function-component-definition': 'off',
    'react/no-unknown-property': ['error', { ignore: ['css'] }],
    /**
     * Having a semicolon helps the optimizer interpret your code correctly.
     * This avoids rare errors in optimized code.
     * @see https://twitter.com/alex_kozack/status/1364210394328408066
     */
    semi: ['error', 'always'],
    /**
     * This will make the history of changes in the hit a little cleaner
     */
    'comma-dangle': ['warn', 'always-multiline'],
    /**
     * Just for beauty
     */
    quotes: ['warn', 'single'],
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
  settings: {
    react: {
      version: 'detect',
      // Tells eslint-plugin-react to automatically detect the version of React
      // to use
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: 'packages/*/tsconfig.json',
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx'],
      },
    },
    'import/core-modules': ['electron'],
    'mdx/code-blocks': true,
  },
};
