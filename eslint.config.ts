import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "build/**"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // your rules here
    },
  },
];