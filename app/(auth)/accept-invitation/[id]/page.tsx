import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import AuthPageIntro from "@/components/auth/AuthPageIntro";
import BackToLoginLink from "@/components/auth/BackToLoginLink";
import SignupForm from "@/components/auth/SignupForm";
import {
  AcceptInvitationButton,
  SignOutButton,
} from "@/components/auth/AcceptInvitationActions";
import { AUTH_PRIMARY_LINK_CLASS } from "@/components/auth/authStyles";
import { auth } from "@/lib/auth";
import { findOrganizationByRequestHost } from "@/lib/organizationFromHost";
import {
  InvitationService,
  type Invitation,
} from "@/lib/services/InvitationService";
import { MembersService } from "@/lib/services/MemberService";
import { UserService } from "@/lib/services/UserService";

export const metadata: Metadata = { title: "Accept Invitation" };

const ROLE_LABEL: Partial<Record<string, string>> = {
  owner: "an owner",
  admin: "an admin",
  member: "a member",
};

function roleLabel(role: string) {
  return ROLE_LABEL[role] ?? role;
}

function sameEmail(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function invitedTitle(invitation: Invitation) {
  return `You've been invited to join ${invitation.organizationName} as ${roleLabel(invitation.role)}`;
}

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: invitationId } = await params;
  const requestHeaders = await headers();
  const organization = await findOrganizationByRequestHost(
    requestHeaders.get("host"),
  );
  if (!organization) notFound();

  const invitation = await InvitationService.findByIdAndOrganization(
    invitationId,
    organization.id,
  );
  if (!invitation) notFound();

  const session = await auth.api.getSession({ headers: requestHeaders });
  const signedInUser = session?.user;
  const isInvitee =
    signedInUser !== undefined &&
    sameEmail(signedInUser.email, invitation.email);

  if (isInvitee) {
    const membership = await MembersService.findByUserAndOrganization(
      signedInUser.id,
      invitation.organizationId,
    );
    if (membership) redirect("/");
  }

  if (!InvitationService.isOpen(invitation)) {
    return (
      <>
        <AuthPageIntro
          title="This invitation is no longer valid"
          description="It has expired or was already used. Ask the person who invited you to send a new one."
        />
        <BackToLoginLink />
      </>
    );
  }

  const loginHref = `/login?redirect=${encodeURIComponent(
    `/accept-invitation/${invitationId}`,
  )}`;

  if (signedInUser && !isInvitee) {
    return (
      <>
        <AuthPageIntro
          title={invitedTitle(invitation)}
          description={`This invitation is for ${invitation.email}, but you're signed in as ${signedInUser.email}. Sign out, then open the link again.`}
        />
        <SignOutButton />
      </>
    );
  }

  if (isInvitee) {
    return (
      <>
        <AuthPageIntro
          title={invitedTitle(invitation)}
          description={`Signed in as ${invitation.email}.`}
        />
        <AcceptInvitationButton invitationId={invitationId} />
      </>
    );
  }

  const account = await UserService.findByEmailAndOrganization(
    invitation.email.toLowerCase(),
    invitation.organizationId,
  );

  if (account) {
    return (
      <>
        <AuthPageIntro
          title={invitedTitle(invitation)}
          description={`You already have an account with ${invitation.email}. Log in to accept.`}
        />
        <Link href={loginHref} className={AUTH_PRIMARY_LINK_CLASS}>
          Log in to accept
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthPageIntro
        title={invitedTitle(invitation)}
        description="Create your account to accept."
      />
      <SignupForm
        invitation={{ id: invitation.id, email: invitation.email }}
        loginHref={loginHref}
      />
    </>
  );
}
