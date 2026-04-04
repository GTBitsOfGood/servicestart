import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveOrganizationIdFromHeaders } from "@/lib/authUtils";
import { MembersService } from "@/lib/services/MemberService";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import { JoinRequestStatus } from "@/lib/schema";

export const metadata = {
  title: "Join request status",
};

export default async function JoinRequestStatusPage() {
  const headerList = await headers();
  const session = await auth.api.getSession({
    headers: headerList,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const organizationId = await getActiveOrganizationIdFromHeaders(headerList);
  if (!organizationId) {
    redirect("/");
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );
  if (membership) {
    redirect("/");
  }

  const joinRequest = await JoinRequestsService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );
  if (!joinRequest || joinRequest.status !== JoinRequestStatus.Pending) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <h1
        className="mb-4 text-center font-normal text-heading-1 text-grey-text-strong"
        data-testid="join-request-status-heading"
      >
        Join request pending
      </h1>
      <p className="max-w-md text-center text-body text-grey-text-muted">
        Your request to join this organization is waiting for an administrator.
        You will get access to the dashboard once it is approved.
      </p>
    </div>
  );
}
