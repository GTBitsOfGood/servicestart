import { redirect } from "next/navigation";
import { OrganizationsService } from "@/lib/services/organizations";
import authClient from "@/lib/authClient";

interface Props {
  params: {
    slug: string;
  };
}

export default async function OrganizationPage({ params }: Props) {
  const session = await authClient.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;
  const organization = await OrganizationsService.findBySlug(params.slug);

  if (!organization) {
    redirect("/");
  }
  const membership = organization.members.find(
    (member: any) => member.userId === user.id,
  );
  if (!membership) {
    redirect("/");
  }
  const isAdminOrOwner =
    membership.role === "ADMIN" || membership.role === "OWNER";
  //frontend tbd
  return (
    <div>
      <h1>{user.name}</h1>
    </div>
  );
}
