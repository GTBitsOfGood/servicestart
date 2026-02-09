import { NextResponse } from "next/server";
import { ShiftService } from "@/lib/services/ShiftService";
import { MembersService } from "@/lib/services/members";
import { auth } from "@/lib/auth";
import z from "zod";

export const UpdateShiftSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  startTimestamp: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  duration: z.string().optional(),
  rsvpLimit: z.number().optional(),
});

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
  const updateData = UpdateShiftSchema.parse(body);

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
