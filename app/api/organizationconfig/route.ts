import { auth } from "@/lib/auth";
import {
  OrganizationConfigKey,
  ORGANIZATION_CONFIG_KEY_VALUES,
} from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { OrganizationsService } from "@/lib/services/organizations";
import { MembersService } from "@/lib/services/members";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const keysStr = searchParams.get("keys");
  const organizationSlug = searchParams.get("organizationSlug");

  if (keysStr === null) {
    return NextResponse.json({}, { status: 200 });
  }
  const keys = keysStr.split(",");

  let organizationId;
  if (organizationSlug === null) {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (session?.session.activeOrganizationId) {
      organizationId = session?.session.activeOrganizationId;
    } else {
      return NextResponse.json(
        { error: "No organizationId provided" },
        { status: 400 },
      );
    }
  } else {
    const organization =
      await OrganizationsService.findBySlug(organizationSlug);

    if (!organization) {
      return NextResponse.json(
        { error: "Requested organization does not exist" },
        { status: 400 },
      );
    }

    organizationId = organization.id;
  }

  const result = await OrganizationConfigService.getConfig(
    organizationId,
    keys as OrganizationConfigKey[],
  );

  return NextResponse.json(result, { status: 200 });
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

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

  const bodySchema = z.object({
    key: z.enum(ORGANIZATION_CONFIG_KEY_VALUES, { error: "Invalid key" }),
    value: z.string({ error: "Missing value" }),
  });

  const json = await request.json().catch(() => undefined);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    await OrganizationConfigService.setConfig(
      activeOrganizationId,
      parsed.data.key as OrganizationConfigKey,
      parsed.data.value,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid value";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
