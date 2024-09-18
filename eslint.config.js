// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/',
      '**/node_modules/**'
    ]
  },
  {
    files: [
      'demo/**/*.{js,ts}'
    ],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  }
);
