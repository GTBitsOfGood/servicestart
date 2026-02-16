import { redirect } from "next/navigation";
import { authClient } from "@/lib/";

export default async function ProfilePage() {
  const session = await authClient.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;

  return (
    <div>
      <h1>{user.name}</h1>
    </div>
  );
}
