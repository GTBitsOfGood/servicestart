import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";

export default async function MediaPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const activeOrganizationId = session.session.activeOrganizationId;
  if (!activeOrganizationId) {
    redirect("/");
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    activeOrganizationId,
  );

  if (!MembersService.isAdminOrOwner(membership?.role)) {
    redirect("/");
  }

  return (
    <main>
      <h1>Media</h1>
    </main>
  );
}
