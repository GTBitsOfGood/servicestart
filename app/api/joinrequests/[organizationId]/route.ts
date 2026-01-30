import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { joinRequests } from "@/lib/schema";

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

  const [joinRequest] = await db
    .select({
      id: joinRequests.id,
      status: joinRequests.status,
      createdAt: joinRequests.createdAt,
    })
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.userId, session.user.id),
        eq(joinRequests.organizationId, organizationId),
      ),
    )
    .limit(1);

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

  const [joinRequest] = await db
    .select({
      id: joinRequests.id,
      status: joinRequests.status,
    })
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.userId, session.user.id),
        eq(joinRequests.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!joinRequest) {
    return NextResponse.json(
      { error: "Join request not found" },
      { status: 404 },
    );
  }

  if (joinRequest.status !== "pending") {
    return NextResponse.json(
      { error: "Cannot delete a non-pending join request" },
      { status: 403 },
    );
  }

  await db.delete(joinRequests).where(eq(joinRequests.id, joinRequest.id));

  return NextResponse.json({ success: true });
}
