import { handleError } from "@/core/api/handleError";
import { resolveOrganization } from "@/core/tenant/resolveOrganization";
import { InternalServerError, NotFoundError } from "@/core/api/errors";
import { requireAuth } from "@/core/auth/authUtils";
import path from "node:path";
import { Hono } from "hono";
import { FileService } from "@/core/files/FileService";
import { MediaService } from "@/features/media/services/MediaService";
import { MembersService } from "@/features/membership/services/MemberService";

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

const app = new Hono()
  .onError(handleError)
  .basePath("/images")
  .get("/:id", async (c) => {
    const { id } = c.req.param();

    const session = await requireAuth(c);

    const organization = await resolveOrganization(c, session);
    const mediaRecord = organization
      ? ((await MediaService.findById(id, organization.id)) ??
        (await MediaService.findOwnProfileImage(
          id,
          organization.id,
          session.user.id,
        )))
      : null;
    if (!mediaRecord) {
      throw new NotFoundError("Image not found");
    }

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      mediaRecord.organizationId,
    );
    if (!membership) {
      throw new NotFoundError("Image not found");
    }

    try {
      const buffer = await FileService.readFile(
        mediaRecord.organizationId,
        mediaRecord.fileName,
      );

      const contentType = getContentType(mediaRecord.fileName);

      return new Response(
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer,
        {
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(buffer.length),
            "Cache-Control": "private, max-age=3600",
          },
        },
      );
    } catch (err) {
      const code =
        err instanceof Error && "code" in err
          ? (err as NodeJS.ErrnoException).code
          : null;
      if (code === "ENOENT") {
        throw new NotFoundError("Image not found");
      }
      console.error(err);
      throw new InternalServerError("Failed to load image");
    }
  });

export default app;
