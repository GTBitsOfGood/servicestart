import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin } from "@/lib/authUtils";
import { NotFoundError } from "@/lib/errors";
import { FormIdSchema } from "@/lib/forms/schema";
import { OrganizationConfigKey } from "@/lib/schema";
import {
  InformationRequestNotFoundError,
  InformationRequestService,
  RecentInformationRequestError,
} from "@/lib/services/InformationRequestService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

const requestSchema = z.object({
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
    if (error instanceof RecentInformationRequestError)
      return c.json({ error: error.message }, 409);
    if (error instanceof HTTPException)
      return c.json({ error: error.message }, error.status);
    console.error(error);
    return c.json({ error: "Unable to send the request" }, 500);
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
