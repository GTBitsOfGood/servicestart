import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin } from "@/core/auth/authUtils";
import { assertFeatureEnabled } from "@/core/auth/featureGuards";
import { OrganizationConfigKey } from "@/core/config/schema";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import { MemberTypeService } from "@/features/membership/server";
import { handleMemberTypeRouteError } from "@/features/membership/api/memberTypeRouteErrors";

const createBodySchema = z.strictObject({
  label: z.string().trim().min(1),
  pluralLabel: z.string().trim().min(1),
});

const updateBodySchema = z.strictObject({
  label: z.string().trim().min(1),
  pluralLabel: z.string().trim().min(1),
});

const signupDefaultBodySchema = z.strictObject({
  key: MemberTypeKeySchema.nullable(),
});

const keyParamSchema = z.object({ key: MemberTypeKeySchema });

const app = new Hono<{ Variables: { organizationId: string } }>()
  .onError(handleMemberTypeRouteError)
  .use("*", async (c, next) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;
    await assertFeatureEnabled(
      organizationId,
      OrganizationConfigKey.MemberTypesEnabled,
    );
    c.set("organizationId", organizationId);
    await next();
  })
  .get("/", async (c) =>
    c.json(await MemberTypeService.list(c.get("organizationId"))),
  )
  .post("/", zValidator("json", createBodySchema), async (c) =>
    c.json(
      await MemberTypeService.create(
        c.get("organizationId"),
        c.req.valid("json"),
      ),
    ),
  )
  .patch(
    "/:key",
    zValidator("param", keyParamSchema),
    zValidator("json", updateBodySchema),
    async (c) =>
      c.json(
        await MemberTypeService.update(
          c.get("organizationId"),
          c.req.valid("param").key,
          c.req.valid("json"),
        ),
      ),
  )
  .put("/order", zValidator("json", z.array(MemberTypeKeySchema)), async (c) =>
    c.json(
      await MemberTypeService.reorder(
        c.get("organizationId"),
        c.req.valid("json"),
      ),
    ),
  )
  .put(
    "/signupDefault",
    zValidator("json", signupDefaultBodySchema),
    async (c) => {
      await MemberTypeService.setSignupDefault(
        c.get("organizationId"),
        c.req.valid("json").key,
      );
      return c.json({ ok: true });
    },
  )
  .delete("/:key", zValidator("param", keyParamSchema), async (c) => {
    await MemberTypeService.delete(
      c.get("organizationId"),
      c.req.valid("param").key,
    );
    return c.json({ ok: true });
  });

export default app;
