import { drizzle } from "drizzle-orm/node-postgres";
import { relations, schema } from "./schema";
import { getDbUrl } from "./env";

/**
 * Will replace <branch> in the DB_URL with the current branch name from
 * NEXT_PUBLIC_BRANCH_NAME. If NEXT_PUBLIC_BRANCH_NAME is not set, it will
 * default to "main". If NEXT_PUBLIC_BRANCH_NAME starts with "pull/", that
 * prefix will be removed.
 */
export { getDbUrl } from "./env";

export default drizzle(getDbUrl(), {
  relations,
  schema,
  casing: "snake_case",
});
