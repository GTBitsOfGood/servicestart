import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { JoinRequestStatus, JOIN_REQUEST_STATUS_VALUES } from "@/lib/schema";
import { JoinRequestsService } from "@/lib/services/joinRequests";
import { MembersService } from "@/lib/services/members";

// Schema for GET pagination parameters
const getParamsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || "1", 10);
      return isNaN(num) ? 1 : num;
    })
    .pipe(z.number().int().min(1, "Page must be at least 1")),
  pageSize: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || "20", 10);
      return isNaN(num) ? 20 : num;
    })
    .pipe(
      z
        .number()
        .int()
        .min(1, "Page size must be at least 1")
        .max(100, "Page size must be at most 100"),
    ),
});

// Schema for PATCH parameters
const patchParamsSchema = z.object({
  id: z.string({ error: "Missing required parameters: id and status" }).min(1),
  status: z.enum(JOIN_REQUEST_STATUS_VALUES, {
    error: "Invalid status. Must be pending, approved, or denied",
  }),
});

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
  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    activeOrganizationId,
  );

  if (!MembersService.isAdminOrOwner(membership?.role)) {
    return NextResponse.json(
      { error: "Forbidden: Admin or owner role required" },
      { status: 403 },
    );
  }

  // Parse and validate pagination parameters with Zod
  const url = new URL(request.url);
  const parsed = getParamsSchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const { page, pageSize } = parsed.data;
  const offset = (page - 1) * pageSize;

  // Query join requests for the organization
  const requests = await JoinRequestsService.listByOrganization(
    activeOrganizationId,
    { limit: pageSize, offset },
  );

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
  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    activeOrganizationId,
  );

  if (!MembersService.isAdminOrOwner(membership?.role)) {
    return NextResponse.json(
      { error: "Forbidden: Admin or owner role required" },
      { status: 403 },
    );
  }

  // Parse and validate query parameters with Zod
  const url = new URL(request.url);
  const parsed = patchParamsSchema.safeParse({
    id: url.searchParams.get("id"),
    status: url.searchParams.get("status"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { id: joinRequestId, status: newStatus } = parsed.data;

  // Find the join request
  const joinRequest = await JoinRequestsService.findByIdAndOrganization(
    joinRequestId,
    activeOrganizationId,
  );

  if (!joinRequest) {
    return NextResponse.json(
      { error: "Join request not found" },
      { status: 404 },
    );
  }

  // If already approved, don't change anything
  if (joinRequest.status === JoinRequestStatus.Approved) {
    return NextResponse.json({
      message: "Join request is already approved",
      joinRequest,
    });
  }

  // Update the status
  const updatedRequest = await JoinRequestsService.updateStatus(
    joinRequestId,
    newStatus as JoinRequestStatus,
  );

  // If new status is approved, add the user to the organization
  if (newStatus === JoinRequestStatus.Approved) {
    await auth.api.addMember({
      body: {
        organizationId: activeOrganizationId,
        userId: joinRequest.userId,
        role: "member",
      },
    });
  }

  return NextResponse.json(updatedRequest);
}
