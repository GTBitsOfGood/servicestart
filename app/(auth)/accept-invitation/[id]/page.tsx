import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import AuthPageIntro from "@/core/auth/components/AuthPageIntro";
import BackToLoginLink from "@/core/auth/components/BackToLoginLink";
import SignupForm from "@/core/auth/components/SignupForm";
import {
  AcceptInvitationButton,
  SignOutButton,
} from "@/core/auth/components/AcceptInvitationActions";
import { AUTH_PRIMARY_LINK_CLASS } from "@/core/auth/components/authStyles";
import { auth } from "@/core/auth/auth";
import { resolveOrganization } from "@/core/tenant/resolveOrganization";
import {
  InvitationService,
  type Invitation,
} from "@/features/membership/services/InvitationService";
import { MembersService } from "@/features/membership/services/MemberService";
import { UserService } from "@/features/membership/services/UserService";

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
  const session = await auth.api.getSession({ headers: requestHeaders });
  const organization = await resolveOrganization(requestHeaders, session);
  if (!organization) notFound();

  const invitation = await InvitationService.findByIdAndOrganization(
    invitationId,
    organization.id,
  );
  if (!invitation) notFound();

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
