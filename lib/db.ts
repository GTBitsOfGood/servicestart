import { drizzle } from "drizzle-orm/node-postgres";
import { relations, schema } from "./schema";

/**
 * Will replace <branch> in the DB_URL with the current branch name from
 * NEXT_PUBLIC_BRANCH_NAME. If NEXT_PUBLIC_BRANCH_NAME is not set, it will
 * default to "main". If NEXT_PUBLIC_BRANCH_NAME starts with "pull/", that
 * prefix will be removed.
 */
export function getDbUrl(branchName: string | undefined = undefined): string {
  if (!process.env.DB_URL) {
    return "";
  }

  branchName ??= process.env.NEXT_PUBLIC_BRANCH_NAME || "main";
  if (branchName.startsWith("pull/") && branchName.endsWith("/head")) {
    branchName = `pr${branchName.slice("pull/".length, -"/head".length)}`;
  }

  return process.env.DB_URL.replace("<branch>", `${branchName}`);
}

export default drizzle(getDbUrl(), {
  relations,
  schema,
  casing: "snake_case",
});
