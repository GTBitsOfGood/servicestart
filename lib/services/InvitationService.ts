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

async function findById(invitationId: string) {
  const [invitation] = await db
    .select({
      id: invitations.id,
      organizationId: invitations.organizationId,
    })
    .from(invitations)
    .where(eq(invitations.id, invitationId))
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

/**
 * Accepts an invitation for the user it was sent to: adds them to the
 * invitation's organization with the invited role and marks it accepted.
 * Returns the invited role, or `undefined` when the invitation can't be accepted.
 */
async function acceptForUser(
  invitationId: string,
  organizationId: string,
  user: { id: string; email: string },
): Promise<string | undefined> {
  const invitation = await findByIdAndOrganization(
    invitationId,
    organizationId,
  );
  if (!invitation) return undefined;
  if (!isOpen(invitation)) return undefined;
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return undefined;
  }

  const [existing] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.userId, user.id),
        eq(members.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (existing) return undefined;

  const now = new Date();

  return db.transaction(async (tx) => {
    const [accepted] = await tx
      .update(invitations)
      .set({ status: InvitationStatus.Accepted })
      .where(
        and(
          eq(invitations.id, invitation.id),
          eq(invitations.organizationId, organizationId),
          eq(invitations.status, InvitationStatus.Pending),
          gt(invitations.expiresAt, now),
        ),
      )
      .returning({ role: invitations.role });
    if (!accepted) return undefined;

    await tx.insert(members).values({
      id: randomUUID(),
      userId: user.id,
      organizationId,
      role: accepted.role,
    });

    return accepted.role;
  });
}

export const InvitationService = {
  findById,
  findByIdAndOrganization,
  acceptForUser,
  isOpen,
};
