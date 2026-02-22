import { juno } from "@/lib/services/junoClient";
import { MembersService } from "@/lib/services/members";
import { OrganizationsService } from "@/lib/services/organizations";

async function emailMembers(
  organizationId: string,
  email: { subject: string; textBody: string; htmlBody?: string },
) {
  const [organization, recipients] = await Promise.all([
    OrganizationsService.findById(organizationId),
    MembersService.listMemberContacts(organizationId),
  ]);

  if (!organization || recipients.length === 0) {
    return;
  }

  const senderDomain =
    process.env.EMAIL_SENDER_DOMAIN?.trim() ||
    new URL(
      process.env.BETTER_AUTH_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://localhost:3000",
    ).hostname;

  if (!organization.slug) {
    throw new Error(
      `Organization ${organization.id} is missing slug for sender email`,
    );
  }

  const normalizedOrganization = organization.slug
    .trim()
    .toLowerCase()
    // normalize org name
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalizedOrganization) {
    throw new Error(
      `Cannot derive sender email local-part for organization ${organization.id}`,
    );
  }

  const senderEmail = `${normalizedOrganization}@${senderDomain}`;

  await juno.email.sendEmail({
    recipients,
    sender: {
      email: senderEmail,
      name: organization.name,
    },
    subject: email.subject,
    contents: email.htmlBody
      ? [
          { type: "text/plain", value: email.textBody },
          { type: "text/html", value: email.htmlBody },
        ]
      : [{ type: "text/plain", value: email.textBody }],
  });
}

async function registerOrganizationSender({
  organizationId,
  organizationName,
  organizationSlug,
}: {
  organizationId: string;
  organizationName: string;
  organizationSlug?: string | null;
}) {
  const senderDomain =
    process.env.EMAIL_SENDER_DOMAIN?.trim() ||
    new URL(
      process.env.BETTER_AUTH_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://localhost:3000",
    ).hostname;

  if (!organizationSlug) {
    throw new Error(
      `Organization ${organizationId} is missing slug for sender email`,
    );
  }

  const normalizedOrganization = organizationSlug
    .trim()
    .toLowerCase()
    // normalize org name
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalizedOrganization) {
    throw new Error(
      `Cannot derive sender email local-part for organization ${organizationName}`,
    );
  }

  const senderEmail = `${normalizedOrganization}@${senderDomain}`;

  await juno.email.registerSenderAddress({
    email: senderEmail,
    name: organizationName,
    replyTo: senderEmail,
    nickname: organizationName,
    address: "801 Atlantic Dr NW",
    city: "Atlanta",
    state: "GA",
    zip: "30332",
    country: "US",
  });
}

export const EmailService = {
  emailMembers,
  registerOrganizationSender,
};
