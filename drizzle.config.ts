import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { getDbUrl } from "./core/utils/env";

// Schema generation/checking needs no live database or credentials.
const needsDatabase = process.argv.some((arg) =>
  ["migrate", "push", "pull", "studio"].includes(arg),
);

export default defineConfig({
  out: "./drizzle",
  schema: "./core/db/schema.ts",
  dialect: "postgresql",
  ...(needsDatabase || process.env.DB_URL?.trim()
    ? { dbCredentials: { url: getDbUrl() } }
    : {}),
});
