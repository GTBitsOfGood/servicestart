import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import db from "@/lib/db";

export const auth = betterAuth({
  experimental: {
    joins: true, // Enable experimental joins feature for performance improvements
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
});
