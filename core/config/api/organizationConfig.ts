import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { auth } from "@/core/auth/auth";
import { requireAdmin } from "@/core/auth/authUtils";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  ConfigValidationError,
  decodeConfigValue,
  readableVisibilities,
} from "@/core/config/defineConfig";
import { getConfigDefinition, isConfigKey } from "@/core/config/registry";
import {
  AUDIENCE_KEYED_CONFIG_KEYS,
  OrganizationConfigKey,
  ORGANIZATION_CONFIG_KEY_VALUES,
} from "@/core/config/schema";
import { OrganizationsService } from "@/core/tenant/OrganizationService";
import { resolveOrganization } from "@/core/tenant/resolveOrganization";
import { pruneAudienceRecord } from "@/features/dashboard";
import {
  MembersService,
  MemberTypeService,
} from "@/features/membership/server";

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

const AUDIENCE_KEYED: ReadonlySet<OrganizationConfigKey> = new Set(
  AUDIENCE_KEYED_CONFIG_KEYS,
);

/**
 * An audience-keyed value (dashboard header, navbar, member type layouts)
 * without entries for member types the org no longer has (#336), so a new
 * type that reuses a deleted type's key starts clean. Other values pass
 * through; the store validates every value.
 */
async function withoutDeletedMemberTypes(
  organizationId: string,
  key: OrganizationConfigKey,
  value: unknown,
): Promise<unknown> {
  if (!AUDIENCE_KEYED.has(key)) return value;
  const decoded = decodeConfigValue(getConfigDefinition(key), value);
  if (!decoded.success) throw decoded.error;
  const keys = (await MemberTypeService.list(organizationId)).map(
    (row) => row.key,
  );
  return pruneAudienceRecord(decoded.data as Record<string, unknown>, keys);
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
        // The tenant host's org, or the session's active org on the default
        // host (#335).
        session = await auth.api.getSession({ headers: c.req.header() });
        const organization = await resolveOrganization(c, session);
        if (!organization) {
          return c.json({ error: "No organizationId provided" }, 400);
        }
        organizationId = organization.id;
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

      const organizationId = c.get("organizationId");
      await OrganizationConfigService.setConfig(
        organizationId,
        key as OrganizationConfigKey,
        await withoutDeletedMemberTypes(
          organizationId,
          key as OrganizationConfigKey,
          value,
        ),
      );

      return c.json({ ok: true }, 200);
    },
  );

export default app;
