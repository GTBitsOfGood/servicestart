import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

// Tests import services, which import "server-only" to fail a client bundle
// that reaches them. Outside Next that package throws, so tests get its no-op.
const SERVER_ONLY_STUB = fileURLToPath(
  new URL("./node_modules/server-only/empty.js", import.meta.url),
);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["./tests/unit/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    env: loadEnv("test", process.cwd(), ""),
    passWithNoTests: true,
    setupFiles: ["./tests/unit/setup.ts"],
    fileParallelism: true,
    hookTimeout: 120_000,
    testTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: [
        "core/**/*.{ts,tsx}",
        "features/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
      ],
    },
  },
  resolve: {
    alias: {
      "@/": "/",
      "server-only": SERVER_ONLY_STUB,
    },
  },
});
