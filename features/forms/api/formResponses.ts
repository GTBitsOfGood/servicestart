import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin } from "@/core/auth/authUtils";
import { OrganizationConfigKey } from "@/core/config/schema";
import { FormIdSchema } from "@/features/forms/lib/schema";
import { FormError } from "@/features/forms/lib/management";
import {
  BulkReviewStatusSchema,
  ResponseListQuerySchema,
  ReviewStatusSchema,
} from "@/features/forms/lib/review";
import {
  FormReviewService,
  SubmissionNotFoundError,
} from "@/features/forms/services/FormReviewService";
import { assertFeatureEnabled } from "@/core/auth/featureGuards";
import { handleError } from "@/core/api/handleError";

const app = new Hono<{
  Variables: { organizationId: string; userId: string };
}>()
  .onError((error, c) => {
    if (error instanceof SubmissionNotFoundError)
      return c.json({ error: error.message }, 404);
    if (error instanceof FormError && error.reason === "not-found")
      return c.json({ error: error.message }, 404);
    return handleError(error, c);
  })
  .use("*", async (c, next) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;
    await assertFeatureEnabled(
      organizationId,
      OrganizationConfigKey.FormsEnabled,
    );
    c.set("organizationId", organizationId);
    c.set("userId", session.user.id);
    await next();
  })
  .get(
    "/:formId",
    zValidator("param", z.object({ formId: FormIdSchema })),
    zValidator("query", ResponseListQuerySchema),
    async (c) =>
      c.json(
        await FormReviewService.listResponses(
          c.get("organizationId"),
          c.req.valid("param").formId,
          c.req.valid("query"),
        ),
      ),
  )
  .post(
    "/status/preview",
    zValidator("json", BulkReviewStatusSchema),
    async (c) =>
      c.json(
        await FormReviewService.previewStatusChange({
          organizationId: c.get("organizationId"),
          ...c.req.valid("json"),
        }),
      ),
  )
  .patch("/status", zValidator("json", BulkReviewStatusSchema), async (c) =>
    c.json(
      await FormReviewService.setReviewStatus({
        organizationId: c.get("organizationId"),
        actorId: c.get("userId"),
        ...c.req.valid("json"),
      }),
    ),
  )
  .patch(
    "/:submissionId/status",
    zValidator("param", z.object({ submissionId: z.uuid() })),
    zValidator("json", ReviewStatusSchema),
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
