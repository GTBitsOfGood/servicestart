import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) {
    redirect("/");
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );

  if (!MembersService.isAdminOrOwner(membership?.role)) {
    redirect("/");
  }

  return <>{children}</>;
}
