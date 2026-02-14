import {
  mkdir,
  readFile as fsReadFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { media } from "@/lib/schema";
import type { InferInsertModel } from "drizzle-orm";

export type MediaUploadInput = Omit<
  InferInsertModel<typeof media>,
  "id" | "uploadedAt"
>;

async function upload(mediaInput: MediaUploadInput, file: File) {
  const dir = process.env.FILE_STORAGE_DIR;
  if (!dir) {
    throw new Error("FILE_STORAGE_DIR environment variable is not set");
  }

  const filePath = path.join(
    dir,
    mediaInput.organizationId,
    mediaInput.fileName,
  );
  await mkdir(path.dirname(filePath), { recursive: true });
  const arrayBuffer =
    typeof file.arrayBuffer === "function"
      ? await file.arrayBuffer()
      : await new Response(file as Blob).arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(filePath, buffer);
}

async function deleteFile(organizationId: string, fileName: string) {
  const dir = process.env.FILE_STORAGE_DIR;
  if (!dir) {
    throw new Error("FILE_STORAGE_DIR environment variable is not set");
  }

  const filePath = path.join(dir, organizationId, fileName);
  try {
    await unlink(filePath);
  } catch (err) {
    const code =
      err instanceof Error && "code" in err
        ? (err as NodeJS.ErrnoException).code
        : null;
    if (code !== "ENOENT") throw err;
  }
}

async function readFile(organizationId: string, fileName: string) {
  const dir = process.env.FILE_STORAGE_DIR;
  if (!dir) {
    throw new Error("FILE_STORAGE_DIR environment variable is not set");
  }
  const filePath = path.join(dir, organizationId, fileName);
  return fsReadFile(filePath);
}

export const FileService = {
  upload,
  deleteFile,
  readFile,
};
