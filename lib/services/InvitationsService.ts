import { invitations } from "../schema";
import db from "../db";
import { and, eq, gt } from "drizzle-orm";

async function findPendingByEmailAndOrganization(
  email: string,
  organizationId: string,
) {
  return db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        eq(invitations.organizationId, organizationId),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
}
async function accept(invitationId: string) {
  const updated = await db
    .update(invitations)
    .set({ status: "accepted" })
    .where(eq(invitations.id, invitationId))
    .returning({
      id: invitations.id,
      email: invitations.email,
      inviterId: invitations.inviterId,
      organizationId: invitations.organizationId,
      role: invitations.role,
      status: invitations.status,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
    });

  return updated.length > 0 ? updated[0] : null;
}

export const InvitationsService = {
  findPendingByEmailAndOrganization,
  accept,
};
