import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin } from "@/lib/authUtils";
import { EmailService } from "@/lib/services/EmailService";

const sendEmailSchema = z.object({
  subject: z.string(),
  subtitle: z.string().optional(),
  body: z.string(),
  footer: z.string().optional(),
  recipientIds: z.array(z.string()),
});

function composeEmailBody({
  subtitle,
  body,
  footer,
}: {
  subtitle?: string;
  body: string;
  footer?: string;
}) {
  return [subtitle, body, footer]
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
}

const app = new Hono().post(
  "/",
  zValidator("json", sendEmailSchema),
  async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;
    const { subject, subtitle, body, footer, recipientIds } =
      c.req.valid("json");

    await EmailService.emailMembers(organizationId, {
      subject,
      content: [
        {
          type: "text/plain",
          value: composeEmailBody({ subtitle, body, footer }),
        },
      ],
      targetUserIds: recipientIds,
    });

    return c.json({ success: true });
  },
);

export default app;
