import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { MediaType } from "@/lib/schema";
import { FileService } from "@/lib/services/FileService";
import { MediaService } from "@/lib/services/MediaService";
import { MembersService } from "@/lib/services/MemberService";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function buildStoredFileName(originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  return `${randomUUID()}${extension}`;
}

function buildTitle(originalName: string) {
  return path.basename(originalName, path.extname(originalName));
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeOrganizationId = session.session.activeOrganizationId;
  if (!activeOrganizationId) {
    return NextResponse.json(
      { error: "No active organization selected" },
      { status: 400 },
    );
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    activeOrganizationId,
  );
  if (!MembersService.isAdminOrOwner(membership?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image uploads are supported right now" },
      { status: 400 },
    );
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Image must be 10 MB or smaller" },
      { status: 400 },
    );
  }

  const title = buildTitle(file.name) || "Untitled image";
  const fileName = buildStoredFileName(file.name);
  const mediaInput = {
    organizationId: activeOrganizationId,
    title,
    fileName,
    type: MediaType.Image,
    altText: title,
  };

  try {
    await FileService.upload(mediaInput, file);
    const created = await MediaService.create(mediaInput);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload image",
      },
      { status: 500 },
    );
  }
}
