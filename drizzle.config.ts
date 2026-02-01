import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { getDbUrl } from "./lib/db";

export default defineConfig({
  out: "./drizzle",
  schema: "./lib/schema.ts",
  dialect: "postgresql",
  schemaFilter: "public",
  dbCredentials: {
    url: getDbUrl(),
  },
});
