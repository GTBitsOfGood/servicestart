import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import db from "@/lib/db";
import { createJoinRequestIfNeeded } from "@/lib/authUtils";

export const auth = betterAuth({
  plugins: [organization()],
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_BASE_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          const headers = context?.headers;
          const host =
            headers?.get?.("host") ??
            (headers as Record<string, string> | undefined)?.host;
          await createJoinRequestIfNeeded(user.id, host);
        },
      },
    },
    session: {
      create: {
        after: async (session, context) => {
          const headers = context?.headers;
          const host =
            headers?.get?.("host") ??
            (headers as Record<string, string> | undefined)?.host;
          await createJoinRequestIfNeeded(session.userId, host);
        },
      },
    },
  },
});
