import { NextResponse } from "next/server";
import { ShiftService } from "@/lib/services/ShiftService";
import { MembersService } from "@/lib/services/members";
import { auth } from "@/lib/auth";
import { InferInsertModel } from "drizzle-orm";
import { shifts } from "@/lib/schema";

type ShiftInsert = InferInsertModel<typeof shifts>;
type CreateShiftInput = Omit<ShiftInsert, "id">;
type UpdateShiftInput = Partial<Omit<CreateShiftInput, "organizationId">>;

export async function PATCH(
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

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );

  if (!MembersService.isAdminOrOwner(membership?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { shiftId } = await params;

  const body = await request.json();
  const updateData: UpdateShiftInput = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.startTimestamp !== undefined)
    updateData.startTimestamp = new Date(body.startTimestamp);
  if (body.duration !== undefined) updateData.duration = body.duration;
  if (body.rsvpLimit !== undefined) updateData.rsvpLimit = body.rsvpLimit;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await ShiftService.updateShift(shiftId, updateData);
  const shift = await ShiftService.findById(shiftId);

  return NextResponse.json({ success: true, shift });
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

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );

  if (!MembersService.isAdminOrOwner(membership?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { shiftId } = await params;
  const shift = await ShiftService.deleteById(shiftId);

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, shift });
}

export async function GET(
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

  if (!shift || shift.organizationId !== organizationId) {
    return NextResponse.json(
      { error: "Shift not found or unauthorized" },
      { status: 404 },
    );
  }

  return NextResponse.json({ status: 200, shift });
}
