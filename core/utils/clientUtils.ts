import authClient from "@/core/auth/authClient";

export function isAdmin(
  organization:
    | ReturnType<typeof authClient.useActiveOrganization>["data"]
    | null
    | undefined,
  user:
    | NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"]
    | null
    | undefined,
): boolean {
  if (!organization || !user) {
    return false;
  }
  return (
    organization?.members.some(
      (member) =>
        member.userId === user.id &&
        (member.role === "admin" || member.role === "owner"),
    ) ?? false
  );
}
