import authClient from "./authClient";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export function getBaseUrl() {
  return (
    (process.env.NEXT_PUBLIC_BASE_URL?.includes("main--")
      ? process.env.NEXT_PUBLIC_PROD_URL
      : process.env.NEXT_PUBLIC_BASE_URL) || "http://localhost:3000"
  );
}

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
