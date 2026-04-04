import {
  mkdir,
  readFile as fsReadFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

function getStorageDir(): string {
  const dir = process.env.FILE_STORAGE_DIR;
  if (!dir) {
    throw new Error("FILE_STORAGE_DIR environment variable is not set");
  }
  return dir;
}

async function upload(
  mediaInput: { organizationId: string; fileName: string },
  file: File,
) {
  const dir = getStorageDir();

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
  const dir = getStorageDir();

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

async function readFile(
  organizationId: string,
  fileName: string,
): Promise<Buffer> {
  const dir = getStorageDir();
  const filePath = path.join(dir, organizationId, fileName);
  return fsReadFile(filePath);
}

function getBucketName(organizationId: string): string {
  return path.join(getStorageDir(), organizationId);
}

async function getUploadPresignedUrl(
  organizationId: string,
  fileName: string,
): Promise<{ url: string }> {
  throw new Error("Presigned URLs are not supported with LocalFileService");
}

async function getDownloadPresignedUrl(
  organizationId: string,
  fileName: string,
): Promise<{ url: string }> {
  throw new Error("Presigned URLs are not supported with LocalFileService");
}

export const LocalFileService = {
  upload,
  deleteFile,
  readFile,
  getBucketName,
  getUploadPresignedUrl,
  getDownloadPresignedUrl,
};
