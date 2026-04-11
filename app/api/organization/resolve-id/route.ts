import { NextRequest, NextResponse } from "next/server";
import { OrganizationsService } from "@/lib/services/OrganizationService";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  const org = await OrganizationsService.findBySlug(slug);
  if (!org?.id) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }
  return NextResponse.json({ organizationId: org.id });
}
