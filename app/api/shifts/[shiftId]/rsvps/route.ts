import { NextResponse } from "next/server";
import { ShiftService } from "@/lib/services/ShiftService";
import { MembersService } from "@/lib/services/members";
import { auth } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = session.session.activeOrganizationId;

  if (!organizationId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 },
    );
  }

  const { shiftId } = await params;
  const shift = await ShiftService.findById(shiftId);

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  if (shift.organizationId !== organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 404 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (userId) {
    const membership = await MembersService.findByUserAndOrganization(
      userId,
      organizationId,
    );

    if (!MembersService.isAdminOrOwner(membership?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (membership) {
      await ShiftService.addRSVP(shiftId, userId);
    }
  } else {
    await ShiftService.addRSVP(shiftId, session.user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = session.session.activeOrganizationId;

  if (!organizationId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 },
    );
  }

  const { shiftId } = await params;
  const shift = await ShiftService.findById(shiftId);

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  if (shift.organizationId !== organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 404 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (userId) {
    const membership = await MembersService.findByUserAndOrganization(
      userId,
      organizationId,
    );

    if (!MembersService.isAdminOrOwner(membership?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (membership) {
      await ShiftService.deleteRSVP(shiftId, userId);
    }
  } else {
    await ShiftService.deleteRSVP(shiftId, session.user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}
