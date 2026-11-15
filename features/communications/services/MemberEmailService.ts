import "server-only";
import { juno } from "@/core/files/junoClient";
import { organizationSenderEmail } from "@/core/email/EmailService";
import { OrganizationsService } from "@/core/tenant/OrganizationService";
import { MembersService } from "@/features/membership/server";

export type EmailMembersResult = "sent" | "no-recipients" | "delivery-failed";

/** Emails an organization's members, or only `targetUserIds` among them. */
async function emailMembers(
  organizationId: string,
  email: {
    subject: string;
    content: { type: "text/plain" | "text/html"; value: string }[];
    targetUserIds?: string[];
  },
): Promise<EmailMembersResult> {
  const [organization, allRecipients] = await Promise.all([
    OrganizationsService.findById(organizationId),
    MembersService.listMemberContacts(organizationId),
  ]);

  if (!organization) {
    return "no-recipients";
  }

  const targetUserIds = email.targetUserIds && new Set(email.targetUserIds);
  const recipients =
    targetUserIds === undefined
      ? allRecipients
      : allRecipients.filter((recipient) =>
          targetUserIds.has(recipient.userId),
        );

  if (recipients.length === 0) {
    return "no-recipients";
  }

  if (!organization.slug) {
    throw new Error(
      `Organization ${organization.id} is missing slug for sender email`,
    );
  }

  const senderEmail = organizationSenderEmail(organization.slug);
  if (!senderEmail) {
    throw new Error(
      `Cannot derive sender email local-part for organization ${organization.id}`,
    );
  }

  const result = await juno.email.sendEmail({
    recipients: recipients.map(({ email, name }) => ({ email, name })),
    sender: { email: senderEmail, name: organization.name },
    subject: email.subject,
    contents: email.content,
  });

  return result.success ? "sent" : "delivery-failed";
}

export const MemberEmailService = {
  emailMembers,
};
