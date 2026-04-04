import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin } from "@/lib/authUtils";
import { EmailService } from "@/lib/services/EmailService";

const sendEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
  recipientIds: z.array(z.string()),
});

const app = new Hono().post(
  "/send",
  zValidator("json", sendEmailSchema),
  async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;
    const { subject, body, recipientIds } = c.req.valid("json");

    await EmailService.emailMembers(organizationId, {
      subject,
      content: [{ type: "text/plain", value: body }],
      targetUserIds: recipientIds,
    });

    return c.json({ success: true });
  },
);

export default app;
