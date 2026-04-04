import { Hono } from "hono";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireMembership } from "@/lib/authUtils";
import { FileService } from "@/lib/services/FileService";
import { MediaService } from "@/lib/services/MediaService";
import { MediaType } from "@/lib/schema";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const BLOCKED_IMAGE_TYPES = new Set(["image/svg+xml"]);

function buildStoredFileName(originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  return `${randomUUID()}${extension}`;
}

function buildTitle(originalName: string) {
  return path.basename(originalName, path.extname(originalName));
}

const app = new Hono().post("/picture", async (c) => {
  const session = await requireMembership(c);
  const activeOrganizationId = session.session.activeOrganizationId!;

  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || typeof file === "string") {
    return c.json(
      {
        error: "File is required. Send multipart/form-data with a 'file' field",
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
    return c.json({ error: "Image must be 10 MB or smaller" }, { status: 400 });
  }

  const fileName = buildStoredFileName(file.name ?? `pfp-${Date.now()}`);
  const mediaInput = {
    organizationId: activeOrganizationId,
    title: buildTitle(file.name) ?? "Profile photo",
    fileName,
    type: MediaType.Image,
    altText: "",
  };

  try {
    await FileService.upload(mediaInput, file);
    const media = await MediaService.create(mediaInput);
    return c.json({ url: `/images/${media.id}` }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to upload file";
    return c.json({ error: message }, { status: 500 });
  }
});

export default app;
