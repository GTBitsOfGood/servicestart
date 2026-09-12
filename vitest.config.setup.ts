import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Configuration failures must be testable without PostgreSQL or live credentials.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/config/**/*.test.ts"],
    environment: "node",
  },
});
