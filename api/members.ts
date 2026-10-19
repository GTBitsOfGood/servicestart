import { Hono } from "hono";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAdmin } from "@/lib/authUtils";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { paginationQuerySchema } from "@/lib/apiUtils";
import { MemberType } from "@/lib/schema";

const activityQuerySchema = z.object({
  userIds: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val])),
});

const setMemberTypeSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
  memberType: z.enum(MemberType),
});

const app = new Hono()
  .get("/activity", zValidator("query", activityQuerySchema), async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;

    const { userIds } = c.req.valid("query");
    if (userIds.length === 0) {
      return c.json({ error: "userIds must not be empty" }, 400);
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

    if (
      !(await OrganizationConfigService.getMemberTypesEnabled(organizationId))
    ) {
      return c.json({ error: "Member types are not enabled" }, 404);
    }

    const { userIds, memberType } = c.req.valid("json");
    const result = await MembersService.setMemberTypes(
      organizationId,
      userIds,
      memberType,
    );

    if ("error" in result) {
      return result.error === "not_found"
        ? c.json({ error: "Member not found" }, 404)
        : c.json({ error: "Admins can't have a member type" }, 400);
    }

    return c.json({ updated: result.updated });
  });

export default app;
