import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path/win32";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "./"),
    },
  },
});
