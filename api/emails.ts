import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin } from "@/lib/authUtils";
import { EmailService } from "@/lib/services/EmailService";

const sendEmailSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required"),
  body: z.string().trim().min(1, "Message text is required"),
  subtitle: z.string().trim().optional(),
  footer: z.string().trim().optional(),
  recipientIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one recipient"),
});

const app = new Hono().post(
  "/",
  zValidator("json", sendEmailSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: result.error.issues[0]?.message ?? "Invalid email" },
        400,
      );
    }
  }),
  async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;
    const { subject, body, subtitle, footer, recipientIds } =
      c.req.valid("json");

    const sent = await EmailService.emailMembers(organizationId, {
      subject,
      content: [
        {
          type: "text/plain",
          value: [subtitle, body, footer].filter(Boolean).join("\n\n"),
        },
      ],
      targetUserIds: recipientIds,
    });

    if (!sent) {
      return c.json(
        {
          error: "None of the selected recipients belong to this organization",
        },
        400,
      );
    }

    return c.json({ success: true });
  },
);

export default app;
