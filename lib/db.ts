import { drizzle } from "drizzle-orm/node-postgres";
import { relations } from "./schema";

export default drizzle(process.env.DB_URL!, {
  relations,
});
