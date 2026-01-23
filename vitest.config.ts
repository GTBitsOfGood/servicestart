import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    env: loadEnv("test", process.cwd(), ""),
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@/": "/",
    },
  },
});
