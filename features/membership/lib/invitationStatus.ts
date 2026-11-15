/** Statuses BetterAuth's organization plugin writes to `invitations.status`. */
export const InvitationStatus = {
  Pending: "pending",
  Accepted: "accepted",
  Rejected: "rejected",
  Canceled: "canceled",
} as const;
