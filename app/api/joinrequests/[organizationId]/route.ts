import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { JoinRequestStatus } from "@/lib/schema";
import { JoinRequestsService } from "@/lib/services/joinRequests";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = await params;

  const joinRequest = await JoinRequestsService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );

  if (!joinRequest) {
    return NextResponse.json(
      { error: "Join request not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(joinRequest);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = await params;

  const joinRequest = await JoinRequestsService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );

  if (!joinRequest) {
    return NextResponse.json(
      { error: "Join request not found" },
      { status: 404 },
    );
  }

  if (joinRequest.status !== JoinRequestStatus.Pending) {
    return NextResponse.json(
      { error: "Cannot delete a non-pending join request" },
      { status: 403 },
    );
  }

  await JoinRequestsService.deleteById(joinRequest.id);

  return NextResponse.json({ success: true });
}
