import path from "node:path";
import { Hono } from "hono";
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

const app = new Hono().basePath("/images").get("/:id", async (c) => {
  const { id } = c.req.param();

  const session = await auth.api.getSession({
    headers: c.req.header(),
  });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mediaRecord = await MediaService.findById(id);
  if (!mediaRecord) {
    return c.json({ error: "Image not found" }, { status: 404 });
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    mediaRecord.organizationId,
  );
  if (!membership) {
    return c.json({ error: "Image not found" }, { status: 404 });
  }

  try {
    const buffer = await FileService.readFile(
      mediaRecord.organizationId,
      mediaRecord.fileName,
    );

    const contentType = getContentType(mediaRecord.fileName);

    c.header("Content-Type", contentType);
    c.header("Content-Length", String(buffer.length));
    c.header("Cache-Control", "private, max-age=3600");
    return c.body(buffer);
  } catch (err) {
    const code =
      err instanceof Error && "code" in err
        ? (err as NodeJS.ErrnoException).code
        : null;
    if (code === "ENOENT") {
      return c.json({ error: "Image not found" }, { status: 404 });
    }
    return c.json({ error: "Failed to load image" }, { status: 500 });
  }
});

export default app;
