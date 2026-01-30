import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { joinRequests, members } from "@/lib/schema";

const ADMIN_ROLES = ["admin", "owner"];

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeOrganizationId = session.session.activeOrganizationId;

  if (!activeOrganizationId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 },
    );
  }

  // Check if user is admin or owner of the active organization
  const [membership] = await db
    .select({ role: members.role })
    .from(members)
    .where(
      and(
        eq(members.userId, session.user.id),
        eq(members.organizationId, activeOrganizationId),
      ),
    )
    .limit(1);

  if (!membership || !ADMIN_ROLES.includes(membership.role)) {
    return NextResponse.json(
      { error: "Forbidden: Admin or owner role required" },
      { status: 403 },
    );
  }

  // Parse pagination parameters
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.max(
    1,
    Math.min(100, parseInt(url.searchParams.get("pageSize") || "20", 10)),
  );
  const offset = (page - 1) * pageSize;

  // Query join requests for the organization
  const requests = await db
    .select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      status: joinRequests.status,
      createdAt: joinRequests.createdAt,
    })
    .from(joinRequests)
    .where(eq(joinRequests.organizationId, activeOrganizationId))
    .limit(pageSize)
    .offset(offset);

  return NextResponse.json({
    data: requests,
    page,
    pageSize,
  });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeOrganizationId = session.session.activeOrganizationId;

  if (!activeOrganizationId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 },
    );
  }

  // Check if user is admin or owner of the active organization
  const [membership] = await db
    .select({ role: members.role })
    .from(members)
    .where(
      and(
        eq(members.userId, session.user.id),
        eq(members.organizationId, activeOrganizationId),
      ),
    )
    .limit(1);

  if (!membership || !ADMIN_ROLES.includes(membership.role)) {
    return NextResponse.json(
      { error: "Forbidden: Admin or owner role required" },
      { status: 403 },
    );
  }

  // Parse query parameters
  const url = new URL(request.url);
  const joinRequestId = url.searchParams.get("id");
  const newStatus = url.searchParams.get("status");

  if (!joinRequestId || !newStatus) {
    return NextResponse.json(
      { error: "Missing required parameters: id and status" },
      { status: 400 },
    );
  }

  if (!["pending", "approved", "denied"].includes(newStatus)) {
    return NextResponse.json(
      { error: "Invalid status. Must be pending, approved, or denied" },
      { status: 400 },
    );
  }

  // Find the join request
  const [joinRequest] = await db
    .select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      organizationId: joinRequests.organizationId,
      status: joinRequests.status,
    })
    .from(joinRequests)
    .where(eq(joinRequests.id, joinRequestId))
    .limit(1);

  if (!joinRequest || joinRequest.organizationId !== activeOrganizationId) {
    return NextResponse.json(
      { error: "Join request not found" },
      { status: 404 },
    );
  }

  // If already approved, don't change anything
  if (joinRequest.status === "approved") {
    return NextResponse.json({
      message: "Join request is already approved",
      joinRequest,
    });
  }

  // Update the status
  await db
    .update(joinRequests)
    .set({ status: newStatus as "pending" | "approved" | "denied" })
    .where(eq(joinRequests.id, joinRequestId));

  // If new status is approved, add the user to the organization
  if (newStatus === "approved") {
    await auth.api.addMember({
      body: {
        organizationId: activeOrganizationId,
        userId: joinRequest.userId,
        role: "member",
      },
    });
  }

  const [updatedRequest] = await db
    .select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      status: joinRequests.status,
      createdAt: joinRequests.createdAt,
    })
    .from(joinRequests)
    .where(eq(joinRequests.id, joinRequestId))
    .limit(1);

  return NextResponse.json(updatedRequest);
}
