import "server-only";
import { getTenantOrigin } from "@/core/tenant/urls";
import { juno } from "@/core/files/junoClient";
import { OrganizationsService } from "@/core/tenant/OrganizationService";
import { getEmailSenderDomain } from "@/core/utils/env";
import { getBaseUrl } from "@/core/utils/urls";

function senderDomain() {
  return getEmailSenderDomain();
}

/**
 * An organization's sender address, `<slug>@mail.<sender domain>`, with the
 * slug lowercased and runs of other characters turned into "-". Null when
 * nothing is left of the slug.
 */
export function organizationSenderEmail(slug: string): string | null {
  const localPart = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return localPart ? `${localPart}@mail.${senderDomain()}` : null;
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

  const senderEmail = organizationSenderEmail(organizationSlug);
  if (!senderEmail) {
    throw new Error(
      `Cannot derive sender email local-part for organization ${organizationName}`,
    );
  }

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

  const senderEmail = organizationSenderEmail(organization.slug);
  if (!senderEmail) {
    throw new Error(
      `Cannot derive sender email local-part for organization ${organization.id}`,
    );
  }
  const acceptUrl = new URL(
    `/accept-invitation/${encodeURIComponent(id)}`,
    getTenantOrigin(organization.slug, getBaseUrl()),
  ).href;

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

async function sendResetPasswordEmail({
  email,
  slug,
  name,
  url,
}: {
  email: string;
  slug: string;
  name: string;
  url: string;
}) {
  const organization = await OrganizationsService.findBySlug(slug);

  if (!organization) {
    throw new Error(`Cannot derive sender email for organization`);
  }

  const senderEmail = organizationSenderEmail(slug);
  if (!senderEmail) {
    throw new Error(
      `Cannot derive sender email local-part for organization ${organization.id}`,
    );
  }

  await juno.email.sendEmail({
    recipients: [{ email }],
    sender: {
      email: senderEmail,
      name: organization.name,
    },
    subject: `Reset Password for ${organization.name}`,
    contents: [
      {
        type: "text/plain",
        value: [
          `Hi ${name},`,
          ``,
          `A password reset has been requested for your account.`,
          ``,
          `Reset your password here: ${url}`,
          ``,
          `If you weren't expecting this, you can safely ignore this email.`,
        ].join("\n"),
      },
    ],
  });
}

export const EmailService = {
  registerOrganizationSender,
  sendInvitationEmail,
  sendResetPasswordEmail,
};
