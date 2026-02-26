import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, organization } from "better-auth/plugins";
import db from "@/lib/db";
import { createJoinRequestIfNeeded } from "@/lib/authUtils";
import { headers } from "next/headers";
import { getSlugFromHost } from "./clientAuthUtils";
import { sessions } from "./schema";
import { eq } from "drizzle-orm";
import { EmailService } from "@/lib/services/EmailService";

export const auth = betterAuth({
  plugins: [
    organization({
      organizationHooks: {
        afterCreateOrganization: async ({ organization }) => {
          await EmailService.registerOrganizationSender({
            organizationId: organization.id,
            organizationName: organization.name,
            organizationSlug: organization.slug,
          });
        },
      },
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
      displayName: {
        type: "string",
        required: false,
      },
      pronouns: {
        type: "string",
        required: false,
      },
      location: {
        type: "string",
        required: false,
      },
    },
  },
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
            await auth.api.setActiveOrganization({
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
