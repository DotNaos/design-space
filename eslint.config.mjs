import typescriptParser from "@typescript-eslint/parser";

import designSpace from "./eslint-rules/one-component-per-file.mjs";

export default [
  {
    // Test fixtures are not indexed as framework component source. Production
    // and example components remain covered by the rule below.
    ignores: ["dist/**", "node_modules/**", "**/*.test.tsx", "**/*.integration.test.tsx"],
  },
  {
    files: ["src/**/*.tsx", "examples/**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: { "design-space": designSpace },
    rules: {
      "design-space/one-component-per-file": "error",
    },
  },
];
