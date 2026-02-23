import { redirect } from "next/navigation";
import { OrganizationsService } from "@/lib/services/organizations";
import { MembersService } from "@/lib/services/members";
import authClient from "@/lib/authClient";
import { headers } from "next/headers";

export default async function OrganizationPage({
  params,
}: {
  params: { slug: string };
}) {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  });

  if (!session?.data?.user) {
    redirect("/login");
  }
  const user = session.data!.user!;
  const organization = await OrganizationsService.findBySlug(params.slug);

  if (!organization) {
    redirect("/");
  }
  const membership = await MembersService.findByUserAndOrganization(
    user.id,
    organization!.id,
  );
  if (!membership) {
    redirect("/");
  }
  //const adminOrOwner = MembersService.isAdminOrOwner(membership.role);
  //frontend tbd
  return (
    <div>
      <h1>{user.name}</h1>
    </div>
  );
}
