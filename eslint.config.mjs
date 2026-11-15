// @ts-check

import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import vitest from "@vitest/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier/flat";

/*
 * Boundary rule (#333). See "Folders and boundaries" in docs/ARCHITECTURE.md.
 *
 * - A context imports another only through its public API, never through a
 *   file inside it: index.ts (@/features/<name>) for contracts and pure code,
 *   server.ts (@/features/<name>/server) for services, and ui.ts
 *   (@/features/<name>/ui) for React components and widgets.
 * - core/ never imports features/. The exceptions are the barrels that
 *   collect every context's tables (core/db/schema.ts) and config keys
 *   (core/config/registry.ts), and the RPC client's `import type { AppType }`.
 * - @/core/db and drizzle-orm are only for a context's services/, core/,
 *   scripts/, and tests/. Each context's schema.ts may build tables, and
 *   type-only drizzle-orm imports are fine anywhere.
 * - app/, scripts/, tests/, features/app.ts, and features/registry.ts are
 *   composition code and may import any context's internals.
 */
const CONTEXTS = [
  "communications",
  "dashboard",
  "events",
  "forms",
  "media",
  "membership",
  "navigation",
  "settings",
];

const RULE = "@typescript-eslint/no-restricted-imports";

const DB = [
  {
    regex: "^@/core/db(/|$)",
    message:
      "Only services, core/, scripts/, and tests/ use the database. Call a service instead.",
  },
  {
    regex: "^drizzle-orm(/|$)",
    allowTypeImports: true,
    message:
      "Only services, core/, scripts/, and tests/ use Drizzle. Call a service instead.",
  },
];

/** Deep imports into any context but `own`, other than its server.ts and ui.ts. */
const otherContexts = (own) => ({
  regex: `^@/features/(?!${own}(/|$))[^/]+/(?!(server|ui)$)`,
  message:
    "Import another context through its public API (@/features/<context>, /server for services, /ui for components), not a file inside it.",
});

const NO_FEATURES = {
  regex: "^@/features(/|$)",
  message:
    "core/ is shared by every feature, so it can't import one. Move the shared code into core/, or have the feature pass it in.",
};

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  vitest.configs.recommended,
  eslintConfigPrettier,
  globalIgnores([
    "node_modules/",
    ".next/",
    "components/bog/",
    "juno/",
    "playwright-report/",
    "test-results/",
    "coverage/",
  ]),
  {
    rules: {
      "vitest/valid-title": "off", // Caused issues with using functions as test titles
    },
  },

  // Boundary rule. A later block replaces an earlier one's options for the
  // same file, so each block lists every pattern that applies to its files.
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    rules: { [RULE]: ["error", { patterns: DB }] },
  },
  ...CONTEXTS.map((context) => ({
    files: [`features/${context}/**/*.{ts,tsx}`],
    rules: { [RULE]: ["error", { patterns: [otherContexts(context), ...DB] }] },
  })),
  ...CONTEXTS.map((context) => ({
    files: [
      `features/${context}/services/**/*.{ts,tsx}`,
      `features/${context}/schema.ts`,
    ],
    rules: { [RULE]: ["error", { patterns: [otherContexts(context)] }] },
  })),
  {
    files: ["core/**/*.{ts,tsx}"],
    rules: { [RULE]: ["error", { patterns: [NO_FEATURES] }] },
  },
  {
    files: ["core/api/client.ts"],
    rules: {
      [RULE]: [
        "error",
        { patterns: [{ ...NO_FEATURES, allowTypeImports: true }] },
      ],
    },
  },
  {
    // The Drizzle barrel, the config registry, and the feature registry
    // collect every context's tables, config keys, and manifests by design.
    files: [
      "core/db/schema.ts",
      "core/config/registry.ts",
      "features/app.ts",
      "features/registry.ts",
      "scripts/**",
      "tests/**",
    ],
    rules: { [RULE]: "off" },
  },
);
