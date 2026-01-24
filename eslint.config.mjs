// @ts-check

import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import vitest from "@vitest/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  vitest.configs.recommended,
  eslintConfigPrettier,
  globalIgnores(["node_modules/", ".next/"]),
  {
    rules: {
      "vitest/valid-title": "off", // Caused issues with using functions as test titles
    },
  },
);
