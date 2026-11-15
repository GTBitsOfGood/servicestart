import "server-only";
import { resolveOrganization } from "@/core/tenant/resolveOrganization";
import { users } from "@/core/auth/schema";
import { createUserOverride } from "@/core/auth/authUtils";
import { findUserByEmailOverride } from "@/core/auth/authUtils";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, organization } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import db from "@/core/db";
import { getAuthHook } from "@/core/auth/authHooks";
import {
  getSlugFromHost,
  getTenantRootDomain,
} from "@/core/tenant/clientAuthUtils";
import { eq } from "drizzle-orm";
import { EmailService } from "@/core/email/EmailService";
import { getBaseUrl } from "@/core/utils/urls";
import { requireEnv } from "@/core/utils/env";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./authValidation";
import { OrganizationsService } from "@/core/tenant/OrganizationService";

const baseURL = process.env.BETTER_AUTH_URL || getBaseUrl();

/**
 * Tenants are served from subdomains of the tenant root domain (`<slug>.lvh.me`
 * in local development). Better Auth only trusts its base URL by default and
 * rejects cookie-bearing requests from other origins, so trust the tenant
 * hosts too. Outside production, also trust localhost, which serves the
 * default tenant locally, so it keeps working when BETTER_AUTH_URL points at
 * another tenant's host. These are static patterns rather than a per-request
 * function because Better Auth stores per-request origins on a context shared
 * by concurrent requests.
 */
export function tenantTrustedOrigins(authBaseURL: string): string[] {
  const { protocol, port } = new URL(authBaseURL);
  const suffix = port ? `:${port}` : "";
  const isProduction = process.env.NODE_ENV === "production";
  const roots = [getTenantRootDomain()];
  if (!isProduction && !roots.includes("lvh.me")) {
    roots.push("lvh.me");
  }
  const origins = roots.flatMap((root) => [
    `${protocol}//${root}${suffix}`,
    `${protocol}//*.${root}${suffix}`,
  ]);
  if (!isProduction) {
    origins.push(`${protocol}//localhost${suffix}`);
  }
  return origins;
}

export const auth = betterAuth({
  secret: requireEnv("BETTER_AUTH_SECRET"),
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
        beforeCreateInvitation: async ({ invitation }) => {
          // Invites are the only way to create admins; never owners.
          if (invitation.role !== "member" && invitation.role !== "admin") {
            throw new APIError("FORBIDDEN", {
              message: "Invitations can only be for the member or admin role.",
            });
          }
        },
        // The membership context records the removal and cancels upcoming
        // RSVPs (see core/auth/authHooks.ts).
        beforeRemoveMember: async ({ member }) => {
          await getAuthHook("beforeRemoveMember")(member);
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
        member: {
          additionalFields: {
            // The member's type key, or null. Server code sets it; clients can't,
            // since it gates what a member can see.
            memberType: {
              type: "string",
              required: false,
              input: false,
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
      organizationSlug: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  baseURL,
  trustedOrigins: tenantTrustedOrigins(baseURL),
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    sendResetPassword: async ({ user, url }, request) => {
      const [record] = await db
        .select({ organizationId: users.organizationId })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      const organization = await resolveOrganization(
        request?.headers ?? new Headers(),
        {
          session: { activeOrganizationId: record?.organizationId },
        },
      );
      const slug = organization?.slug;
      if (!slug) return;

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
          // Signup's join request or membership; see core/auth/authHooks.ts.
          const headers = context?.headers;
          await getAuthHook("afterSessionCreated")(session.userId, headers);
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Only identity lookups need an organization-specific adapter. Other
      // BetterAuth endpoints resolve their own authenticated session; the
      // shared context here is not a request-authenticated session.
      if (
        ![
          "/sign-up/email",
          "/sign-in/email",
          "/request-password-reset",
        ].includes(ctx.path)
      )
        return;
      const requestHeaders = ctx.headers ?? new Headers();
      const hostSlug = getSlugFromHost(requestHeaders.get("host"));
      const hint =
        requestHeaders.get("x-organization-slug") ?? ctx.body?.organizationSlug;
      // An explicit hint is needed by API sign-in/sign-up on default hosts.
      // A tenant host always wins, including when its organization is missing.
      const session =
        !hostSlug && !hint
          ? await auth.api.getSession({ headers: requestHeaders })
          : null;
      const organization = hostSlug
        ? await resolveOrganization(requestHeaders)
        : hint
          ? await OrganizationsService.findBySlug(hint)
          : await resolveOrganization(requestHeaders, session);
      const organizationId = organization?.id;
      if (!organizationId) {
        throw new APIError("NOT_FOUND", { message: "Organization not found" });
      }

      ctx.context.organizationId = organizationId;
      ctx.context.internalAdapter.createUser = createUserOverride(
        ctx,
      ) as unknown as typeof ctx.context.internalAdapter.createUser;
      ctx.context.internalAdapter.findUserByEmail = findUserByEmailOverride(
        ctx,
        organizationId,
      ) as unknown as typeof ctx.context.internalAdapter.findUserByEmail;
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/login")) {
        const session = ctx.context.session;
        if (session?.user) {
          const requestHeaders = ctx.headers ?? new Headers();
          const organization = await resolveOrganization(
            requestHeaders,
            session,
          );
          if (organization)
            await auth.api.setActiveOrganization({
              body: { organizationId: organization.id },
              headers: requestHeaders,
            });
        }
      }
    }),
  },
});
