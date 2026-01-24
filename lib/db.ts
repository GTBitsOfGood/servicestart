import { drizzle } from "drizzle-orm/node-postgres";
import { relations, schema } from "./schema";

export default drizzle(process.env.DB_URL!, {
  relations,
  schema,
  casing: "snake_case",
});
