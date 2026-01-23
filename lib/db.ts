import { drizzle } from "drizzle-orm/node-postgres";

export default drizzle(process.env.DB_URL!);
