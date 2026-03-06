import { Hono } from "hono";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAdmin } from "@/lib/authUtils";
import { MembersService } from "@/lib/services/MemberService";
import { paginationQuerySchema } from "@/lib/apiUtils";

const activityQuerySchema = z.object({
  userIds: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val])),
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
  });

export default app;
