import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  // Global ignores
  globalIgnores([
    "**/dist/**",
    "**/node_modules/**",
    "**/build/**",
    "**/coverage/**",
    "**/.react-router/**",
    "**/tsconfig.tsbuildinfo",
  ]),

  // Base TypeScript config for all workspaces
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...tseslint.configs["recommended"].rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },

  // Prettier must be last to disable conflicting formatting rules
  eslintConfigPrettier,
]);
