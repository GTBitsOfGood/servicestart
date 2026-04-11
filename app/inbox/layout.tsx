import { redirectIfNotMember } from "@/lib/authUtils";

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectIfNotMember();

  return <>{children}</>;
}
