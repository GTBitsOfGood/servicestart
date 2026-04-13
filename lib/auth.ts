import { betterAuth, User } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, organization } from "better-auth/plugins";
import db from "@/lib/db";
import { afterUserCreated } from "@/lib/authUtils";
import { headers } from "next/headers";
import { getSlugFromHost } from "./clientAuthUtils";
import {
  eventRsvps,
  events,
  sessions,
  shiftRSVPs,
  shifts,
  users,
  members,
} from "./schema";
import { UserService } from "@/lib/services/UserService";
import { and, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { EmailService } from "@/lib/services/EmailService";
import { getBaseUrl } from "./clientUtils";
import { OrganizationsService } from "./services/OrganizationService";

export const auth = betterAuth({
  plugins: [
    organization({
      async sendInvitationEmail(data) {
        await EmailService.sendInvitationEmail({
          id: data.id,
          email: data.email,
          organization: data.organization,
          inviter: data.inviter,
          invitation: data.invitation as unknown as {
            expiresAt: Date;
            role: string;
            name: string;
          },
        });
      },
      organizationHooks: {
        afterCreateOrganization: async ({ organization }) => {
          await EmailService.registerOrganizationSender({
            organizationId: organization.id,
            organizationName: organization.name,
            organizationSlug: organization.slug,
          });
        },
        beforeRemoveMember: async ({ member }) => {
          const now = new Date();

          await Promise.all([
            db.delete(eventRsvps).where(
              and(
                eq(eventRsvps.userId, member.userId),
                inArray(
                  eventRsvps.eventId,
                  db
                    .select({ id: events.id })
                    .from(events)
                    .where(
                      and(
                        eq(events.organizationId, member.organizationId),
                        gt(events.startTimestamp, now),
                        isNotNull(events.startTimestamp),
                      ),
                    ),
                ),
              ),
            ),

            db.delete(shiftRSVPs).where(
              and(
                eq(shiftRSVPs.userId, member.userId),
                inArray(
                  shiftRSVPs.shiftId,
                  db
                    .select({ id: shifts.id })
                    .from(shifts)
                    .where(
                      and(
                        eq(shifts.organizationId, member.organizationId),
                        gt(shifts.startTimestamp, now),
                      ),
                    ),
                ),
              ),
            ),
          ]);
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
        invitation: {
          additionalFields: {
            name: {
              type: "string",
              input: true,
              required: true,
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
      organizationId: {
        type: "string",
        required: true,
        input: true,
      },
    },
  },
  baseURL: process.env.BETTER_AUTH_URL || getBaseUrl(),
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }, request) => {
      const host = request?.headers?.get("host");
      const slug = getSlugFromHost(host || undefined);

      await EmailService.sendResetPasswordEmail({
        email: user.email,
        slug: slug,
        name: user.name,
        url: url,
      });
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session, context) => {
          const headers = context?.headers;
          await afterUserCreated(session.userId, headers);
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      console.log("we are here");
      // --- Multi-tenant BetterAuth DB adapter override ---
      // Get organizationId from headers or context
      const organizationSlug = ctx.headers?.get("x-organization-slug");
      if (!organizationSlug) {
        console.warn(
          "No organization slug provided in request headers. Multi-tenancy may not work correctly.",
        );
        return;
      }
      const organizationId = await OrganizationsService.findBySlug(
        organizationSlug!,
      ).then((org) => org?.id);

      console.log("Organization ID from request:", organizationId);
      // Store in context for later use
      ctx.context.organizationId = organizationId;

      // Override createUser to always use organizationId and user_organizations
      ctx.context.internalAdapter.createUser = (async (user: User) => {
        if (!organizationId)
          throw new Error(
            "organizationId required for multi-tenant user creation",
          );
        const { email, name, ...rest } = user;
        // Try to find user by email
        let existingUser = await UserService.findByEmailAndOrganization(
          email,
          organizationId,
        );
        let id: string;
        if (!existingUser) {
          // Create new user
          id = crypto.randomUUID();
          await db.insert(users).values({
            name: name || "",
            email,
            ...rest,
            id,
          });
          existingUser = await UserService.findById(id);
        } else {
          id = existingUser.id;
        }
        // Create membership in members table if not already present
        const existingMembership = await db
          .select()
          .from(members)
          .where(
            and(
              eq(members.userId, id),
              eq(members.organizationId, organizationId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null);
        if (!existingMembership) {
          await db.insert(members).values({
            id: crypto.randomUUID(),
            userId: id,
            organizationId,
            role: "member",
          });
        }
        return await UserService.findById(id);
      }) as any;

      // Override findUserByEmail to always use organizationId and user_organizations
      ctx.context.internalAdapter.findUserByEmail = async (email, options) => {
        if (!organizationId)
          throw new Error(
            "organizationId required for multi-tenant user lookup",
          );
        const user = await UserService.findByEmailAndOrganization(
          email,
          organizationId,
        );
        if (!user) return null;

        const accounts = await ctx.context.internalAdapter.findAccountByUserId(
          user.id,
        );

        return { user, accounts };
      };
      // --- End override ---

      if (ctx.path.startsWith("/login")) {
        const session = ctx.context.session;
        if (session?.user) {
          const headers = ctx?.headers;
          await afterUserCreated(session.user.id, headers);
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
});
