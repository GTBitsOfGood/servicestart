import { BadRequestError, InternalServerError } from "@/core/api/errors";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin } from "@/core/auth/authUtils";
import { EmailService } from "@/core/email/EmailService";

const sendEmailSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required"),
  body: z.string().trim().min(1, "Message text is required"),
  subtitle: z.string().trim().optional(),
  footer: z.string().trim().optional(),
  recipientIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one recipient"),
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
  zValidator("json", sendEmailSchema, (result) => {
    if (!result.success) {
      throw new BadRequestError(
        result.error.issues[0]?.message ?? "Invalid email",
      );
    }
  }),
  async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;
    const { subject, subtitle, body, footer, recipientIds } =
      c.req.valid("json");

    const result = await EmailService.emailMembers(organizationId, {
      subject,
      content: [
        {
          type: "text/plain",
          value: composeEmailBody({ subtitle, body, footer }),
        },
      ],
      targetUserIds: recipientIds,
    });

    if (result === "no-recipients") {
      throw new BadRequestError(
        "None of the selected recipients belong to this organization",
      );
    }

    if (result === "delivery-failed") {
      throw new InternalServerError("Failed to send email");
    }

    return c.json({ success: true });
  },
);

export default app;
