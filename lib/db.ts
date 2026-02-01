import { drizzle } from "drizzle-orm/node-postgres";
import { relations, schema } from "./schema";

export function getDbUrl(): string {
  if (!process.env.DB_URL) {
    return "";
  }

  if (
    process.env.DB_URL.includes("<branch>") &&
    !process.env.NEXT_PUBLIC_BRANCH_NAME
  ) {
    return process.env.DB_URL.replace("<branch>", "main");
  }

  return process.env.DB_URL.replace(
    "<branch>",
    `"${process.env.NEXT_PUBLIC_BRANCH_NAME!}"`,
  );
}

export default drizzle(getDbUrl(), {
  relations,
  schema,
  casing: "snake_case",
});
