import { juno } from "@/lib/junoClient";
import { JunoFileDeletionNotSupportedError } from "@/lib/errors";
import { media } from "@/lib/schema";
import type { InferInsertModel } from "drizzle-orm";
import { buildAzureBlobBaseUrl, parseJunoNumericId } from "./junoFileUtils";

export type MediaUploadInput = Omit<
  InferInsertModel<typeof media>,
  "id" | "uploadedAt"
>;

function getBucketPrefix(): string {
  return process.env.JUNO_FILE_BUCKET_PREFIX?.trim() ?? "ServiceStart";
}

let cachedFileConfig: { configId: number; providerName: string } | null = null;

async function getFileConfig(): Promise<{
  configId: number;
  providerName: string;
}> {
  const providerName = process.env.FILE_PROVIDER_NAME?.trim();
  if (!providerName) {
    throw new Error("FILE_PROVIDER_NAME environment variable must be set");
  }

  const projectId = process.env.JUNO_PROJECT_ID?.trim();
  if (!projectId)
    throw new Error("JUNO_PROJECT_ID environment variable must be set");

  const fileConfig = await juno.file.getConfig(projectId);
  const configId = parseJunoNumericId(fileConfig.id);
  if (!Number.isFinite(configId)) {
    throw new Error("Juno returned an invalid file config ID");
  }

  if (cachedFileConfig?.providerName === providerName) {
    if (cachedFileConfig.configId === configId) return cachedFileConfig;
  }

  cachedFileConfig = { configId, providerName };
  return cachedFileConfig;
}

function formatBucketOrgName(organizationName: string): string {
  return organizationName.replace(/[^a-zA-Z0-9]/g, "");
}

function getAzureBlobBaseUrl(): string {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  if (!accountName) {
    throw new Error(
      "AZURE_STORAGE_ACCOUNT_NAME environment variable must be set",
    );
  }
  return buildAzureBlobBaseUrl(accountName);
}

function normalizePresignedUrl(
  rawUrl: string,
  bucketName: string,
  fileName: string,
): string {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const query = trimmed.startsWith("?") ? trimmed : `?${trimmed}`;
  const baseUrl = getAzureBlobBaseUrl();
  return `${baseUrl}/${bucketName}/${encodeURIComponent(fileName)}${query}`;
}

function toAzureSafeBucketName(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length >= 3) return normalized.slice(0, 63);
  return `${normalized}xxx`.slice(0, 3);
}

/**
 * Juno file bucket name for an organization, e.g. ServiceStart-OrgABC.
 */
function getBucketName(organizationName: string): string {
  const prefix = getBucketPrefix();
  return toAzureSafeBucketName(
    `${prefix}-Org${formatBucketOrgName(organizationName)}`,
  );
}

async function getUploadPresignedUrl(
  organizationId: string,
  fileName: string,
): Promise<{ url: string }> {
  const { configId, providerName } = await getFileConfig();
  const bucketName = getBucketName(organizationId);
  const res = await juno.file.uploadFile({
    fileName,
    bucketName,
    providerName,
    configId,
  });
  if (!res?.url) {
    throw new Error("Juno did not return an upload URL");
  }
  return { url: normalizePresignedUrl(res.url, bucketName, fileName) };
}

async function getDownloadPresignedUrl(
  organizationId: string,
  fileName: string,
): Promise<{ url: string }> {
  const { configId, providerName } = await getFileConfig();
  const bucketName = getBucketName(organizationId);
  const res = await juno.file.downloadFile({
    fileName,
    bucketName,
    providerName,
    configId,
  });
  if (!res?.url) {
    throw new Error("Juno did not return a download URL");
  }
  return { url: normalizePresignedUrl(res.url, bucketName, fileName) };
}

async function readFile(organizationId: string, fileName: string) {
  const { url } = await getDownloadPresignedUrl(organizationId, fileName);
  const download = await fetch(url);
  if (!download.ok) {
    const err = new Error(`Blob download failed (${download.status})`);
    if (download.status === 404) {
      (err as NodeJS.ErrnoException).code = "ENOENT";
    }
    throw err;
  }
  return Buffer.from(await download.arrayBuffer());
}

async function deleteFile(organizationId: string, fileName: string) {
  // Deletion support isn't available in Juno yet; we still remove the DB record in the app.
  void organizationId;
  void fileName;
  throw new JunoFileDeletionNotSupportedError();
}

export const FileService = {
  getBucketName,
  getUploadPresignedUrl,
  getDownloadPresignedUrl,
  readFile,
  delete: deleteFile,
};
