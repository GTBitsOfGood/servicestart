import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin } from "@/core/auth/authUtils";
import { FormIdSchema } from "@/features/forms/lib/schema";
import { OrganizationConfigKey } from "@/core/config/schema";
import {
  FormNotOpenError,
  InformationRequestNotFoundError,
  InformationRequestService,
  RecentInformationRequestError,
} from "@/features/forms/services/InformationRequestService";
import { assertFeatureEnabled } from "@/core/auth/featureGuards";
import { handleError } from "@/core/api/handleError";

const requestSchema = z.strictObject({
  userId: z.string().min(1),
  formId: FormIdSchema,
  message: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((message) => message || undefined),
});

// Admins asking a member for a missing form (#317).
const app = new Hono<{
  Variables: { organizationId: string; userId: string };
}>()
  .onError((error, c) => {
    if (error instanceof InformationRequestNotFoundError)
      return c.json({ error: error.message }, 404);
    if (
      error instanceof RecentInformationRequestError ||
      error instanceof FormNotOpenError
    )
      return c.json({ error: error.message }, 409);
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
  .post("/", zValidator("json", requestSchema), async (c) => {
    const { userId, formId, message } = c.req.valid("json");
    const notification = await InformationRequestService.request({
      organizationId: c.get("organizationId"),
      userId,
      formId,
      message,
      requestedBy: c.get("userId"),
    });
    return c.json({ id: notification.id }, 201);
  });

export default app;
