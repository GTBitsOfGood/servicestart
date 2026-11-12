import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { NotFoundError } from "@/core/api/errors";
import { requireAdmin } from "@/core/auth/authUtils";
import { assertFeatureEnabled } from "@/core/auth/featureGuards";
import { MembersService } from "@/features/membership/services/MemberService";
import { OrganizationConfigKey } from "@/core/config/schema";
import { paginationQuerySchema } from "@/core/api/apiUtils";
import { MemberTypeError } from "@/features/membership/lib/memberTypeErrors";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import { MemberTypeService } from "@/features/membership/server";
import { handleMemberTypeRouteError } from "@/features/membership/api/memberTypeRouteErrors";

const activityQuerySchema = z.object({
  userIds: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val])),
});

const setMemberTypeSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
  memberType: MemberTypeKeySchema.nullable(),
});

const app = new Hono()
  .onError(handleMemberTypeRouteError)
  .get("/activity", zValidator("query", activityQuerySchema), async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;

    const { userIds } = c.req.valid("query");
    if (userIds.length === 0) {
      throw new HTTPException(400, { message: "userIds must not be empty" });
    }

    const result = await MembersService.getMemberActivity(
      userIds,
      organizationId,
    );
    return c.json(result);
  })
  .get("/", zValidator("query", paginationQuerySchema), async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;

    const { page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      MembersService.listMembers(organizationId, { limit: pageSize, offset }),
      MembersService.countByOrganization(organizationId),
    ]);

    return c.json({ data, total, page, pageSize });
  })
  .patch("/type", zValidator("json", setMemberTypeSchema), async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;

    await assertFeatureEnabled(
      organizationId,
      OrganizationConfigKey.MemberTypesEnabled,
    );

    const { userIds, memberType } = c.req.valid("json");

    if (memberType !== null) {
      const unknown = await MemberTypeService.findUnknownKeys(organizationId, [
        memberType,
      ]);
      if (unknown.length > 0) {
        throw new MemberTypeError("invalid", "Unknown member type");
      }
    }

    const result = await MembersService.setMemberTypes(
      organizationId,
      userIds,
      memberType,
    );

    if ("error" in result) {
      if (result.error === "not_found") {
        throw new NotFoundError("Member not found");
      }
      throw new MemberTypeError("invalid", "Admins can't have a member type");
    }

    return c.json({ updated: result.updated });
  });

export default app;
