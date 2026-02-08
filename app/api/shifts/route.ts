import { NextResponse } from "next/server";
import { ShiftService } from "@/lib/services/ShiftService";
import { MembersService } from "@/lib/services/members";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
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

  const body = await request.json();
  const shift = await ShiftService.createShift({
    organizationId,
    name: body.name || "",
    description: body.description || "",
    startTimestamp: new Date(body.startTimestamp) || new Date(),
    duration: body.duration || "",
    rsvpLimit: body.rsvpLimit || 0,
  });

  return NextResponse.json(shift);
}
