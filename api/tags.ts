import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireMembership, requireAdmin } from "@/lib/authUtils";
import { TagService } from "@/lib/services/TagService";
import {
  ForbiddenError,
  NoActiveOrganizationError,
  UnauthorizedError,
} from "@/lib/errors";

const app = new Hono()
  .get("/", async (c) => {
    const session = await requireMembership(c);
    const organizationId = session.session.activeOrganizationId!;

    const tags = await TagService.listTags(organizationId);
    return c.json({ data: tags });
  })
  .post(
    "/",
    zValidator("json", z.object({ tag: z.string().min(1, "Tag is required") })),
    async (c) => {
      const session = await requireAdmin(c);
      const organizationId = session.session.activeOrganizationId!;

      const data = c.req.valid("json");
      const tag = await TagService.createTag(organizationId, data.tag);

      return c.json({ success: true, data: tag });
    },
  )
  .patch(
    "/:tagId",
    zValidator("json", z.object({ tag: z.string().min(1, "Tag is required") })),
    async (c) => {
      await requireAdmin(c);

      const { tagId } = c.req.param();
      const data = c.req.valid("json");

      await TagService.updateTag(tagId, data.tag);
      return c.json({ success: true });
    },
  )
  .delete("/:tagId", async (c) => {
    await requireAdmin(c);

    const { tagId } = c.req.param();
    await TagService.deleteTag(tagId);

    return c.json({ success: true });
  });

export default app;
