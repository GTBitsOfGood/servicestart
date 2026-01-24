import { drizzle } from "drizzle-orm/node-postgres";
import { relations, schema } from "./schema";

// The string is odd, but it fixes the build. Apparently Drizzle needs something there at build time.
export default drizzle(process.env.DB_URL ?? "", {
  relations,
  schema,
  casing: "snake_case",
});
