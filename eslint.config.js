// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  eslint.configs.all,
  tseslint.configs.all,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/dot-notation": "off",
      "@typescript-eslint/member-ordering": "off",
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/prefer-readonly-parameter-types": "off",
      "capitalized-comments": "off",
      "func-style": "off",
      "id-length": "off",
      "no-continue": "off",
      "no-plusplus": "off",
      "no-undefined": "off",
      "no-underscore-dangle": "off",
      // set to never
      "one-var": "off",
      "sort-imports": "off",
      "sort-keys": "off",
      "sort-vars": "off",
      "no-inline-comments": "off",
      curly: "off",
      "max-lines": "off",
      "max-statements": "off",
      "no-ternary": "off",
      "max-classes-per-file": "off",
      "new-cap": "off",
      "no-console": "off",
      "no-warning-comments": "off",
      "max-lines-per-function": "off",
      "require-unicode-regexp": "off",
      camelcase: "off",
      "@typescript-eslint/method-signature-style": "off",
      "@typescript-eslint/prefer-literal-enum-member": "off",
      "@typescript-eslint/prefer-enum-initializers": "off",
      "prefer-named-capture-group": "off",

      // Should be enabled
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-member-accessibility": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-type-assertion": "off",
      "@typescript-eslint/prefer-readonly": "off",
      "@typescript-eslint/max-params": "off",
      // should be enabled per-file or section to avoid accidental usage
      "no-bitwise": "off",
      "no-multi-assign": "off",
      "no-param-reassign": "off",
      "@typescript-eslint/prefer-destructuring": "off",
      complexity: "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "prefer-template": "off",
      "object-shorthand": "off",
      "@typescript-eslint/init-declarations": "off",
      "@typescript-eslint/class-methods-use-this": "off",
      "equire-unicode-regexp": "off",
      "@typescript-eslint/prefer-string-starts-ends-with": "off",
      "@typescript-eslint/parameter-properties": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      // choose reasonable value
      "max-depth": "off",
      // should be avoided in favor of parallelism
      "no-await-in-loop": "off",
      "default-case": "off",
      "default-case-last": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-deprecated": "off",
      "no-useless-concat": "off",
      "no-negated-condition": "off",
      "@typescript-eslint/no-extraneous-class": "off",
      "operator-assignment": "off",
      "@typescript-eslint/consistent-type-exports": "off",
      "@typescript-eslint/prefer-includes": "off",
      "arrow-body-style": "off",
      "@typescript-eslint/no-useless-constructor": "off",
      "no-else-return": "off",
      "@typescript-eslint/class-literal-property-style": "off",
      "@typescript-eslint/prefer-for-of": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    ignores: ["dist/", "**/node_modules/**", "demo/**", "vite.config.ts"],
  },
  {
    files: ["demo/**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    ignores: ["eslintrc.config.js"],
  },
  {
    files: ["src/**/*.test.ts"],
    rules: {
      "max-lines-per-function": "off",
    },
  }
);
