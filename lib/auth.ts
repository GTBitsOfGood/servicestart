import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, organization } from "better-auth/plugins";
import db from "@/lib/db";
import { createJoinRequestIfNeeded } from "@/lib/authUtils";
import { headers } from "next/headers";
import { getSlugFromHost } from "./clientAuthUtils";
import { sessions } from "./schema";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  plugins: [organization()],
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
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path.startsWith("/login")) {
          const session = ctx.context.session;
          if (session?.user) {
            const headers = ctx?.headers;
            const host =
              headers?.get?.("host") ??
              (headers as Record<string, string> | undefined)?.host;
            await createJoinRequestIfNeeded(session.user.id, host);
          }
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path.startsWith("/login")) {
          const session = ctx.context.session;
          if (session?.user) {
            const theHeaders = ctx?.headers;
            const host =
              theHeaders?.get?.("host") ??
              (theHeaders as Record<string, string> | undefined)?.host;
            const slug = getSlugFromHost(host);
            const [result] = await db
              .select({ activeOrganizationId: sessions.activeOrganizationId })
              .from(sessions)
              .where(eq(sessions.id, session.session.id))
              .limit(1);
            const data = await auth.api.setActiveOrganization({
              body: {
                organizationId: result?.activeOrganizationId,
                organizationSlug: slug,
              },
              headers: await headers(),
            });
          }
        }
      }),
    },
  },
});
