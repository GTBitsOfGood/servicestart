import { drizzle } from "drizzle-orm/node-postgres";
import { relations, schema } from "./schema";

/**
 * Will replace <branch> in the DB_URL with the current branch name from
 * NEXT_PUBLIC_BRANCH_NAME. If NEXT_PUBLIC_BRANCH_NAME is not set, it will
 * default to "main". If NEXT_PUBLIC_BRANCH_NAME starts with "pull/", that
 * prefix will be removed.
 */
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

  if (process.env.NEXT_PUBLIC_BRANCH_NAME?.startsWith("pull/")) {
    process.env.NEXT_PUBLIC_BRANCH_NAME =
      process.env.NEXT_PUBLIC_BRANCH_NAME.slice("pull/".length);
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
