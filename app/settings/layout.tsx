import { redirectIfNotAdmin } from "@/lib/authUtils";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectIfNotAdmin();

  return <>{children}</>;
}
