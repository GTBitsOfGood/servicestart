import { LocalFileService } from "./LocalFileService";
import { JunoFileService } from "./JunoFileService";

/** Where a file is stored: `fileName` within the organization's storage. */
export type StoredFileLocation = { organizationId: string; fileName: string };

export interface IFileService {
  upload(location: StoredFileLocation, file: File): Promise<void>;
  deleteFile(organizationId: string, fileName: string): Promise<void>;
  readFile(organizationId: string, fileName: string): Promise<Buffer>;
  getBucketName(organizationId: string): string;
  getUploadPresignedUrl(
    organizationId: string,
    fileName: string,
  ): Promise<{ url: string }>;
  getDownloadPresignedUrl(
    organizationId: string,
    fileName: string,
  ): Promise<{ url: string }>;
}

export function resolveFileService(): IFileService {
  const provider = process.env.FILE_SERVICE_IMPLEMENTATION;
  if (provider === "juno") {
    return JunoFileService;
  }
  return LocalFileService;
}

export const FileService: IFileService = resolveFileService();
