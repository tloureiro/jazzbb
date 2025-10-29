module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'solid'],
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:solid/typescript',
    'prettier'
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'solid/jsx-no-undef': 'error'
  },
  overrides: [
    {
      files: ['**/*.ts'],
      rules: {
        'solid/reactivity': 'off',
        'solid/jsx-no-undef': 'off'
      }
    },
    {
      files: ['tests/**/*.{ts,tsx}'],
      env: {
        jest: true
      }
    }
  ]
};
