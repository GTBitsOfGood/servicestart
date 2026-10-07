import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import db from "@/lib/db";
import { invitations, members, organizations } from "@/lib/schema";

/** Statuses BetterAuth's organization plugin writes to `invitations.status`. */
export const InvitationStatus = {
  Pending: "pending",
  Accepted: "accepted",
  Rejected: "rejected",
  Canceled: "canceled",
} as const;

export type Invitation = NonNullable<
  Awaited<ReturnType<typeof findByIdAndOrganization>>
>;

/**
 * Loads an invitation with its organization's name, or null when it doesn't
 * exist or belongs to another organization.
 */
async function findByIdAndOrganization(
  invitationId: string,
  organizationId: string,
) {
  const [invitation] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      name: invitations.name,
      role: invitations.role,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      organizationId: invitations.organizationId,
      organizationName: organizations.name,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.organizationId, organizationId),
      ),
    )
    .limit(1);

  return invitation ?? null;
}

/** Whether the invitation can still be accepted at `now`. */
function isOpen(
  invitation: Pick<Invitation, "status" | "expiresAt">,
  now = new Date(),
): boolean {
  return (
    invitation.status === InvitationStatus.Pending && invitation.expiresAt > now
  );
}

/** Outcomes of {@link acceptForUser}; only "accepted" adds a member. */
export const AcceptInvitationResult = {
  Accepted: "accepted",
  NotFound: "not-found",
  Closed: "closed",
  WrongRecipient: "wrong-recipient",
  AlreadyMember: "already-member",
} as const;

export type AcceptInvitationResult =
  (typeof AcceptInvitationResult)[keyof typeof AcceptInvitationResult];

/**
 * Accepts an invitation for the user it was sent to: adds them to the
 * invitation's organization with the invited role and marks it accepted.
 * The invitation must belong to `organizationId`, be open, and be addressed
 * to `user.email`. Doesn't need a session, so it also works while one is
 * being created at sign-up.
 */
async function acceptForUser(
  invitationId: string,
  organizationId: string,
  user: { id: string; email: string },
): Promise<AcceptInvitationResult> {
  const invitation = await findByIdAndOrganization(
    invitationId,
    organizationId,
  );
  if (!invitation) return AcceptInvitationResult.NotFound;
  if (!isOpen(invitation)) return AcceptInvitationResult.Closed;
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return AcceptInvitationResult.WrongRecipient;
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.userId, user.id),
          eq(members.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (existing) return AcceptInvitationResult.AlreadyMember;

    // Re-checks open-ness in the write so two accepts can't both win.
    const [accepted] = await tx
      .update(invitations)
      .set({ status: InvitationStatus.Accepted })
      .where(
        and(
          eq(invitations.id, invitation.id),
          eq(invitations.status, InvitationStatus.Pending),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .returning({ id: invitations.id });
    if (!accepted) return AcceptInvitationResult.Closed;

    await tx.insert(members).values({
      id: randomUUID(),
      userId: user.id,
      organizationId,
      role: invitation.role,
    });
    return AcceptInvitationResult.Accepted;
  });
}

export const InvitationService = {
  findByIdAndOrganization,
  acceptForUser,
  isOpen,
};
