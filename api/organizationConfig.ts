import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  OrganizationConfigKey,
  ORGANIZATION_CONFIG_KEY_VALUES,
} from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { OrganizationsService } from "@/lib/services/OrganizationService";
import { MembersService } from "@/lib/services/MemberService";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { zValidator } from "@hono/zod-validator";

const bodySchema = z.object({
  key: z.enum(ORGANIZATION_CONFIG_KEY_VALUES, { error: "Invalid key" }),
  value: z.string({ error: "Missing value" }),
});

const app = new Hono()
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
      const keys = c.req.valid("query").keys;
      const organizationSlugParam = c.req.valid("query").organizationSlug;

      if (!keys || keys.length === 0) {
        return c.json({}, 200);
      }

      let organizationId: string | undefined;

      if (organizationSlugParam) {
        const organization = await OrganizationsService.findBySlug(
          organizationSlugParam,
        );

        if (!organization) {
          return c.json(
            { error: "Requested organization does not exist" },
            400,
          );
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
          const session = await auth.api.getSession({
            headers: c.req.header(),
          });
          if (session?.session.activeOrganizationId) {
            organizationId = session.session.activeOrganizationId;
          } else {
            return c.json({ error: "No organizationId provided" }, 400);
          }
        }
      }

      const result = await OrganizationConfigService.getConfig(
        organizationId,
        keys as OrganizationConfigKey[],
      );

      return c.json(result, 200);
    },
  )
  .put("/", async (c: Context) => {
    const session = await auth.api.getSession({ headers: c.req.header() });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const activeOrganizationId = session.session.activeOrganizationId;
    if (!activeOrganizationId) {
      return c.json({ error: "No active organization" }, 400);
    }

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
    );

    if (!MembersService.isAdminOrOwner(membership?.role)) {
      return c.json({ error: "Forbidden: Admin or owner role required" }, 403);
    }

    const json = await c.req.json().catch(() => undefined);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request body";
      return c.json({ error: msg }, 400);
    }

    try {
      await OrganizationConfigService.setConfig(
        activeOrganizationId,
        parsed.data.key as OrganizationConfigKey,
        parsed.data.value,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid value";
      return c.json({ error: msg }, 400);
    }

    return c.json({ ok: true }, 200);
  });

export default app;
