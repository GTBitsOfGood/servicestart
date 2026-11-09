import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { auth } from "@/core/auth/auth";
import { requireAdmin } from "@/core/auth/authUtils";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  ConfigValidationError,
  readableVisibilities,
} from "@/core/config/defineConfig";
import { getConfigDefinition, isConfigKey } from "@/core/config/registry";
import {
  OrganizationConfigKey,
  ORGANIZATION_CONFIG_KEY_VALUES,
} from "@/core/config/schema";
import { getSlugFromHost } from "@/core/tenant/clientAuthUtils";
import { OrganizationsService } from "@/core/tenant/OrganizationService";
import { MembersService } from "@/features/membership/server";

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

/** The caller's role in this organization, for what config they may read. */
async function readerRole(session: Session, organizationId: string) {
  if (!session?.user) return null;
  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );
  if (!membership) return null;
  return MembersService.isAdminOrOwner(membership.role) ? "admin" : "member";
}

const app = new Hono<{ Variables: { organizationId: string } }>()
  .onError((error, c) => {
    if (error instanceof ConfigValidationError)
      return c.json({ error: error.message }, 400);
    if (error instanceof HTTPException)
      return c.json({ error: error.message }, error.status);
    console.error(error);
    return c.json({ error: "Unable to update the configuration" }, 500);
  })
  // Returns only the keys the caller may read: public keys for anyone, member
  // keys for the organization's members, and the rest for its admins. Other
  // keys are left out rather than failing the request.
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        keys: z
          .string()
          .array()
          .or(z.string().transform((val) => val.split(",")))
          .optional(),
        organizationSlug: z.string().optional(),
      }),
    ),
    async (c) => {
      const { keys: requested, organizationSlug } = c.req.valid("query");
      const keys = (requested ?? []).filter(isConfigKey);

      if (!requested || requested.length === 0) {
        return c.json({}, 200);
      }

      let organizationId: string | undefined;
      let session: Session | undefined;

      if (organizationSlug) {
        const organization =
          await OrganizationsService.findBySlug(organizationSlug);

        if (!organization) {
          return c.json({ error: "Organization not found" }, 404);
        }

        organizationId = organization.id;
      } else {
        const hostHeader =
          c.req.header("x-forwarded-host") ?? c.req.header("host") ?? undefined;
        const derivedSlug = getSlugFromHost(hostHeader);

        if (derivedSlug && derivedSlug !== "servicestart") {
          const organization =
            await OrganizationsService.findBySlug(derivedSlug);
          if (organization) {
            organizationId = organization.id;
          }
        }

        if (!organizationId) {
          session = await auth.api.getSession({ headers: c.req.header() });
          if (session?.session.activeOrganizationId) {
            organizationId = session.session.activeOrganizationId;
          } else {
            return c.json({ error: "No organizationId provided" }, 400);
          }
        }
      }

      // Signed-out pages only ask for public keys, so skip the session lookup.
      const needsRole = keys.some(
        (key) => getConfigDefinition(key).visibility !== "public",
      );
      let readable = readableVisibilities(null);
      if (needsRole) {
        session ??= await auth.api.getSession({ headers: c.req.header() });
        readable = readableVisibilities(
          await readerRole(session, organizationId),
        );
      }

      const values: Partial<Record<OrganizationConfigKey, unknown>> =
        await OrganizationConfigService.getConfig(
          organizationId,
          keys.filter((key) =>
            readable.has(getConfigDefinition(key).visibility),
          ),
        );

      return c.json(values as Record<string, unknown>, 200);
    },
  )
  .put(
    "/",
    // Check the caller before the body, so a signed-out request is a 401.
    async (c, next) => {
      const session = await requireAdmin(c);
      c.set("organizationId", session.session.activeOrganizationId!);
      await next();
    },
    zValidator(
      "json",
      z.object({
        key: z.enum(ORGANIZATION_CONFIG_KEY_VALUES, { error: "Invalid key" }),
        // A typed value, or its stored text ("true", a JSON string). The key's
        // definition validates it.
        value: z.unknown(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json(
            {
              error: result.error.issues[0]?.message ?? "Invalid request body",
            },
            400,
          );
        }
      },
    ),
    async (c) => {
      const { key, value } = c.req.valid("json");
      if (value === undefined) {
        return c.json({ error: "Missing value" }, 400);
      }

      await OrganizationConfigService.setConfig(
        c.get("organizationId"),
        key as OrganizationConfigKey,
        value,
      );

      return c.json({ ok: true }, 200);
    },
  );

export default app;
