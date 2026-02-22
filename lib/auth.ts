import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import db from "@/lib/db";
import { createJoinRequestIfNeeded } from "@/lib/authUtils";

export const auth = betterAuth({
  plugins: [
    organization({
      schema: {
        organization: {
          additionalFields: {
            phoneNumber: {
              type: "string",
              input: true,
              required: false,
            },
            email: {
              type: "string",
              input: true,
              required: false,
            },
          },
        },
      },
    }),
  ],
  user: {
    additionalFields: {
      phoneNumber: {
        type: "string",
        required: false,
      },
    },
  },
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
