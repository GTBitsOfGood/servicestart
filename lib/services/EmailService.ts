import { juno } from "@/lib/junoClient";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationsService } from "@/lib/services/OrganizationService";

function senderDomain() {
  if (process.env.EMAIL_SENDER_DOMAIN?.trim()) {
    return process.env.EMAIL_SENDER_DOMAIN?.trim();
  } else {
    const url = new URL(
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    );
    return url.hostname;
  }
}

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

  const senderEmail = `${normalizedOrganization}@mail.${senderDomain()}`;

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

  const senderEmail = `${normalizedOrganization}@mail.${senderDomain()}`;

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

async function sendInvitationEmail({
  id,
  email,
  organization,
  inviter,
  invitation,
}: {
  id: string;
  email: string;
  organization: { id: string; name: string; slug?: string };
  inviter: { user: { name: string; email: string } };
  invitation: { expiresAt: Date; role: string; name: string };
}) {
  if (!organization.slug) {
    throw new Error(
      `Cannot derive sender email for organization ${organization.id}`,
    );
  }

  const normalizedOrganization = organization.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalizedOrganization) {
    throw new Error(
      `Cannot derive sender email local-part for organization ${organization.id}`,
    );
  }

  const senderEmail = `${normalizedOrganization}@mail.${senderDomain()}`;
  const acceptUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/accept-invitation/${id}`;

  await juno.email.sendEmail({
    recipients: [{ email }],
    sender: {
      email: senderEmail,
      name: organization.name,
    },
    subject: `You've been invited to join ${organization.name}`,
    contents: [
      {
        type: "text/plain",
        value: [
          `Hi ${invitation.name},`,
          ``,
          `${inviter.user.name} (${inviter.user.email}) has invited you to join ${organization.name} as a ${invitation.role}.`,
          ``,
          `Accept your invitation here: ${acceptUrl}`,
          ``,
          `This invitation expires on ${invitation.expiresAt.toLocaleDateString()}.`,
          ``,
          `If you weren't expecting this, you can safely ignore this email.`,
        ].join("\n"),
      },
    ],
  });
}

export const EmailService = {
  emailMembers,
  registerOrganizationSender,
  sendInvitationEmail,
};
