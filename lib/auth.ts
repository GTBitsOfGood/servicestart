import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";
import db from "@/lib/db";
import { joinRequests, members, organizations } from "@/lib/schema";

const defaultOrganizationSlug = "servicestart";

function getSlugFromHost(host?: string): string {
  if (!host) return defaultOrganizationSlug;

  const normalized = host.toLowerCase().split(":")[0]; // Remove port if present
  const match = normalized.match(/^([a-z0-9-]+)\.servicestart\.com$/);

  return match ? match[1] : defaultOrganizationSlug;
}

async function createJoinRequestIfNeeded(userId: string, host?: string) {
  const slug = getSlugFromHost(host);
  const [organizationRecord] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!organizationRecord) return;

  const [membership] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.userId, userId),
        eq(members.organizationId, organizationRecord.id),
      ),
    )
    .limit(1);

  if (membership) return;

  const [existingRequest] = await db
    .select({ id: joinRequests.id })
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.userId, userId),
        eq(joinRequests.organizationId, organizationRecord.id),
      ),
    )
    .limit(1);

  if (existingRequest) return;

  await db.insert(joinRequests).values({
    id: randomUUID(),
    userId,
    organizationId: organizationRecord.id,
    status: "pending",
  });
}

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
  },
});
