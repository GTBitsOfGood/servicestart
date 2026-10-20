import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin } from "@/lib/authUtils";
import { NotFoundError } from "@/lib/errors";
import { OrganizationConfigKey, SubmissionReviewStatus } from "@/lib/schema";
import {
  FormReviewService,
  SubmissionNotFoundError,
} from "@/lib/services/FormReviewService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

// Admins reviewing form responses. #316 owns this sub-app and adds the
// responses list and bulk status changes; the single status change below is
// here from the pre-sprint (#315) so #317's status dropdown works on its own.

const statusSchema = z.object({ status: z.enum(SubmissionReviewStatus) });

const app = new Hono<{
  Variables: { organizationId: string; userId: string };
}>()
  .onError((error, c) => {
    if (error instanceof SubmissionNotFoundError)
      return c.json({ error: error.message }, 404);
    if (error instanceof HTTPException)
      return c.json({ error: error.message }, error.status);
    console.error(error);
    return c.json({ error: "Unable to update the response" }, 500);
  })
  .use("*", async (c, next) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;
    const config = await OrganizationConfigService.getConfig(organizationId, [
      OrganizationConfigKey.FormsEnabled,
    ]);
    if (!config[OrganizationConfigKey.FormsEnabled]) throw new NotFoundError();
    c.set("organizationId", organizationId);
    c.set("userId", session.user.id);
    await next();
  })
  .patch(
    "/:submissionId/status",
    zValidator("param", z.object({ submissionId: z.uuid() })),
    zValidator("json", statusSchema),
    async (c) => {
      const [change] = await FormReviewService.setReviewStatus({
        organizationId: c.get("organizationId"),
        submissionIds: [c.req.valid("param").submissionId],
        status: c.req.valid("json").status,
        actorId: c.get("userId"),
      });
      return c.json({ id: change.id, reviewStatus: change.reviewStatus });
    },
  );

export default app;
