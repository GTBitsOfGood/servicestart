import type { Metadata } from "next";
import { headers } from "next/headers";
import AuthLayout from "@/components/auth/AuthLayout";
import BackToLoginLink from "@/components/auth/BackToLoginLink";
import SignupForm from "@/components/auth/SignupForm";
import {
  AcceptInvitationButton,
  ContinueLink,
  LogInToAcceptLink,
  SignOutButton,
} from "@/components/auth/AcceptInvitationActions";
import { auth } from "@/lib/auth";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import {
  InvitationService,
  type Invitation,
} from "@/lib/services/InvitationService";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationsService } from "@/lib/services/OrganizationService";
import { UserService } from "@/lib/services/UserService";

export const metadata: Metadata = { title: "Accept Invitation" };

type InvitationView =
  | { kind: "not-found" }
  | { kind: "closed" }
  | { kind: "joined"; invitation: Invitation }
  | { kind: "create-account"; invitation: Invitation }
  | { kind: "log-in"; invitation: Invitation }
  | { kind: "wrong-account"; invitation: Invitation; signedInEmail: string }
  | { kind: "accept"; invitation: Invitation };

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

/** Decides what the invitee sees, from the invitation and who's signed in. */
async function resolveInvitationView(
  invitationId: string,
  requestHeaders: Headers,
): Promise<InvitationView> {
  const organization = await OrganizationsService.findBySlug(
    getSlugFromHost(requestHeaders.get("host") ?? undefined),
  );
  const invitation =
    organization &&
    (await InvitationService.findByIdAndOrganization(
      invitationId,
      organization.id,
    ));
  if (!invitation) return { kind: "not-found" };

  const session = await auth.api.getSession({ headers: requestHeaders });
  const signedInUser = session?.user;
  const isInvitee =
    signedInUser !== undefined &&
    sameEmail(signedInUser.email, invitation.email);
  const membership =
    isInvitee &&
    (await MembersService.findByUserAndOrganization(
      signedInUser.id,
      invitation.organizationId,
    ));

  // Signing up from this page accepts the invitation, so the new invitee
  // lands here already a member if they come back.
  if (membership) return { kind: "joined", invitation };
  if (!InvitationService.isOpen(invitation)) return { kind: "closed" };
  if (signedInUser && !isInvitee) {
    return {
      kind: "wrong-account",
      invitation,
      signedInEmail: signedInUser.email,
    };
  }
  if (isInvitee) return { kind: "accept", invitation };

  const account = await UserService.findByEmailAndOrganization(
    invitation.email.toLowerCase(),
    invitation.organizationId,
  );
  return account
    ? { kind: "log-in", invitation }
    : { kind: "create-account", invitation };
}

function invitedTitle(invitation: Invitation) {
  return `You've been invited to join ${invitation.organizationName} as ${roleLabel(invitation.role)}`;
}

function InvitationContent({
  view,
  invitationId,
}: {
  view: InvitationView;
  invitationId: string;
}) {
  const loginHref = `/login?redirect=${encodeURIComponent(
    `/accept-invitation/${invitationId}`,
  )}`;

  switch (view.kind) {
    case "not-found":
      return (
        <AuthLayout
          title="Invitation not found"
          description="This link doesn't match an invitation here. Check that you opened the whole link from your email."
        >
          <BackToLoginLink />
        </AuthLayout>
      );
    case "closed":
      return (
        <AuthLayout
          title="This invitation is no longer valid"
          description="It has expired or was already used. Ask the person who invited you to send a new one."
        >
          <BackToLoginLink />
        </AuthLayout>
      );
    case "joined":
      return (
        <AuthLayout
          title={`You've joined ${view.invitation.organizationName}`}
          description={`You're in as ${roleLabel(view.invitation.role)}.`}
        >
          <ContinueLink />
        </AuthLayout>
      );
    case "create-account":
      return (
        <AuthLayout
          title={invitedTitle(view.invitation)}
          description="Create your account to accept."
        >
          <SignupForm invitation={view.invitation} loginHref={loginHref} />
        </AuthLayout>
      );
    case "log-in":
      return (
        <AuthLayout
          title={invitedTitle(view.invitation)}
          description={`You already have an account with ${view.invitation.email}. Log in to accept.`}
        >
          <LogInToAcceptLink href={loginHref} />
        </AuthLayout>
      );
    case "wrong-account":
      return (
        <AuthLayout
          title={invitedTitle(view.invitation)}
          description={`This invitation is for ${view.invitation.email}, but you're signed in as ${view.signedInEmail}. Sign out, then open the link again.`}
        >
          <SignOutButton />
        </AuthLayout>
      );
    case "accept":
      return (
        <AuthLayout
          title={invitedTitle(view.invitation)}
          description={`Signed in as ${view.invitation.email}.`}
        >
          <AcceptInvitationButton invitationId={invitationId} />
        </AuthLayout>
      );
    default: {
      const leftover: never = view;
      return leftover;
    }
  }
}

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await resolveInvitationView(id, await headers());
  return <InvitationContent view={view} invitationId={id} />;
}
