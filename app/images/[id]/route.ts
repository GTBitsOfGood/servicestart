import { NextResponse } from "next/server";
import path from "node:path";
import { auth } from "@/lib/auth";
import { FileService } from "@/lib/services/FileService";
import { MediaService } from "@/lib/services/MediaService";
import { MembersService } from "@/lib/services/MemberService";

const IMAGE_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return IMAGE_MIME_TYPES[ext] ?? "image/jpeg";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mediaRecord = await MediaService.findById(id);
  if (!mediaRecord) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    mediaRecord.organizationId,
  );
  if (!membership) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  try {
    const buffer = await FileService.readFile(
      mediaRecord.organizationId,
      mediaRecord.fileName,
    );

    const contentType = getContentType(mediaRecord.fileName);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const code =
      err instanceof Error && "code" in err
        ? (err as NodeJS.ErrnoException).code
        : null;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to load image" },
      { status: 500 },
    );
  }
}
