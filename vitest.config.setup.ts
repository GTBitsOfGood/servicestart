import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Configuration failures must be testable without PostgreSQL or live credentials.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // See vitest.config.ts.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/config/**/*.test.ts"],
    environment: "node",
  },
});
