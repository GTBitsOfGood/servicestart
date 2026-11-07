import { resolveOrganization } from "@/core/tenant/resolveOrganization";
import {
  BadRequestError,
  InternalServerError,
  JunoFileDeletionNotSupportedError,
  NotFoundError,
} from "@/core/api/errors";
import { Hono } from "hono";
import { z } from "zod";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { requireAdmin, requireAuth } from "@/core/auth/authUtils";

import { MembersService } from "@/features/membership/server";
import { FileService } from "@/core/files/FileService";
import { LocalFileService } from "@/core/files/LocalFileService";
import { MediaService } from "@/features/media/services/MediaService";
import { MediaType } from "@/features/media/schema";
import { paginationQuerySchema } from "@/core/api/apiUtils";

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
      throw new BadRequestError(
        "File is required. Send multipart/form-data with a 'file' field",
      );
    }

    if (!file.type.startsWith("image/") || BLOCKED_IMAGE_TYPES.has(file.type)) {
      throw new BadRequestError(
        "Only raster image uploads are supported right now",
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestError("Image must be 10 MB or smaller");
    }

    const parsed = postMediaBodySchema.safeParse({
      title: body["title"],
      altText: body["altText"],
    });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.message);
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
      if (FileService === LocalFileService) {
        const media = await MediaService.create(mediaInput);
        try {
          await FileService.upload(mediaInput, file);
        } catch (uploadErr) {
          await MediaService.deleteById(media.id, activeOrganizationId);
          throw uploadErr;
        }
        return c.json(media, { status: 201 });
      }

      const { url: uploadUrl } = await FileService.getUploadPresignedUrl(
        activeOrganizationId,
        fileName,
      );
      const media = await MediaService.create(mediaInput);
      return c.json({ ...media, uploadUrl }, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to prepare upload";
      throw new InternalServerError(message);
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
    const session = await requireAuth(c);

    const organization = await resolveOrganization(c, session);
    const mediaRecord = organization
      ? await MediaService.findById(id, organization.id)
      : null;
    if (!mediaRecord) {
      throw new NotFoundError("Media not found");
    }

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      mediaRecord.organizationId,
    );
    if (!membership) {
      throw new NotFoundError("Media not found");
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
      throw new NotFoundError("Media not found");
    }

    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const { id } = c.req.param();
    const session = await requireAdmin(c);

    const activeOrganizationId = session.session.activeOrganizationId!;

    const organization = await resolveOrganization(c, session);
    const mediaRecord = organization
      ? await MediaService.findById(id, organization.id)
      : null;
    if (!mediaRecord || mediaRecord.organizationId !== activeOrganizationId) {
      throw new NotFoundError("Media not found");
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
        throw new InternalServerError(message);
      }
    }

    const deleted = await MediaService.deleteById(id, activeOrganizationId);
    if (!deleted) {
      throw new NotFoundError("Media not found");
    }

    return c.json({ success: true });
  });

export default app;
