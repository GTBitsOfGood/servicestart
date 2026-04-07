import { Hono } from "hono";
import { z } from "zod";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authUtils";
import { JunoFileDeletionNotSupportedError } from "@/lib/errors";
import { MembersService } from "@/lib/services/MemberService";
import { FileService } from "@/lib/services/FileService";
import { MediaService } from "@/lib/services/MediaService";
import { MediaType } from "@/lib/schema";
import { paginationQuerySchema } from "@/lib/apiUtils";

const patchMediaSchema = z.object({
  title: z.string().optional(),
  altText: z.string().optional(),
});

const postMediaBodySchema = z.object({
  title: z.string().optional(),
  altText: z.string().default(""),
});

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const BLOCKED_IMAGE_TYPES = new Set(["image/svg+xml"]);

function buildStoredFileName(originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  return `${randomUUID()}${extension}`;
}

function buildTitle(originalName: string) {
  return path.basename(originalName, path.extname(originalName));
}

const app = new Hono()
  .post("/", async (c) => {
    const session = await requireAdmin(c);
    const activeOrganizationId = session.session.activeOrganizationId!;

    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || typeof file === "string") {
      return c.json(
        {
          error:
            "File is required. Send multipart/form-data with a 'file' field",
        },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/") || BLOCKED_IMAGE_TYPES.has(file.type)) {
      return c.json(
        { error: "Only raster image uploads are supported right now" },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return c.json(
        { error: "Image must be 10 MB or smaller" },
        { status: 400 },
      );
    }

    const parsed = postMediaBodySchema.safeParse({
      title: body["title"],
      altText: body["altText"],
    });
    if (!parsed.success) {
      return c.json({ error: parsed.error.message }, { status: 400 });
    }

    const title =
      parsed.data.title ?? buildTitle(file.name) ?? "Untitled image";
    const altText = parsed.data.altText;
    const fileName = buildStoredFileName(file.name ?? `upload-${Date.now()}`);

    const mediaInput = {
      organizationId: activeOrganizationId,
      title,
      fileName,
      type: MediaType.Image,
      altText,
    };

    try {
      const { url: uploadUrl } = await FileService.getUploadPresignedUrl(
        activeOrganizationId,
        fileName,
      );
      const media = await MediaService.create(mediaInput);
      return c.json({ ...media, uploadUrl }, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to prepare upload";
      return c.json({ error: message }, { status: 500 });
    }
  })
  .get("/", zValidator("query", paginationQuerySchema), async (c) => {
    const session = await requireAdmin(c);
    const activeOrganizationId = session.session.activeOrganizationId!;

    const { page, pageSize } = c.req.valid("query");
    const data = await MediaService.listByOrganization(activeOrganizationId, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return c.json({ data, page, pageSize });
  })
  .get("/:id", async (c) => {
    const { id } = c.req.param();
    const session = await auth.api.getSession({ headers: c.req.header() });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mediaRecord = await MediaService.findById(id);
    if (!mediaRecord) {
      return c.json({ error: "Media not found" }, { status: 404 });
    }

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      mediaRecord.organizationId,
    );
    if (!membership) {
      return c.json({ error: "Media not found" }, { status: 404 });
    }

    return c.json(mediaRecord);
  })
  .patch("/:id", zValidator("json", patchMediaSchema), async (c) => {
    const { id } = c.req.param();
    const session = await requireAdmin(c);

    const activeOrganizationId = session.session.activeOrganizationId!;

    const data = c.req.valid("json");
    const updates: { title?: string; altText?: string } = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.altText !== undefined) updates.altText = data.altText;

    const updated = await MediaService.update(
      id,
      activeOrganizationId,
      updates,
    );
    if (!updated) {
      return c.json({ error: "Media not found" }, { status: 404 });
    }

    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const { id } = c.req.param();
    const session = await requireAdmin(c);

    const activeOrganizationId = session.session.activeOrganizationId!;

    const mediaRecord = await MediaService.findById(id);
    if (!mediaRecord || mediaRecord.organizationId !== activeOrganizationId) {
      return c.json({ error: "Media not found" }, { status: 404 });
    }

    try {
      await FileService.deleteFile(
        mediaRecord.organizationId,
        mediaRecord.fileName,
      );
    } catch (err) {
      if (err instanceof JunoFileDeletionNotSupportedError) {
        // Juno blob deletion is not available yet; still remove the app record.
      } else {
        const message =
          err instanceof Error ? err.message : "Failed to delete file";
        return c.json({ error: message }, { status: 500 });
      }
    }

    const deleted = await MediaService.deleteById(id, activeOrganizationId);
    if (!deleted) {
      return c.json({ error: "Media not found" }, { status: 404 });
    }

    return c.json({ success: true });
  });

export default app;
