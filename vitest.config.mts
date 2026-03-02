import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";

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
  },
  resolve: {
    alias: {
      "@/": "/",
    },
  },
});
