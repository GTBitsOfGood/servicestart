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

/**
 * Joins the optional message sections into a single plain-text body.
 *
 * Juno's `contents` array holds alternative representations of the same
 * message (text/plain vs text/html), not stacked sections, so every section
 * has to be composed into one entry. Blank sections are dropped so an unused
 * subtitle or footer leaves no empty gap in the delivered email.
 */
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
