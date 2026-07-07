// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores: ['lib/', 'eslint.config.mjs', 'jest.config.js']},
  ...tseslint.configs.recommended,
  {
    rules: {
      'max-len': ['error', {
        code: 100,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      }],
      // Ported adapter interfaces keep unused args named `_foo`.
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
    },
  },
);
