import { media } from "@/lib/schema";
import type { InferInsertModel } from "drizzle-orm";
import { LocalFileService } from "./LocalFileService";
import { JunoFileService } from "./JunoFileService";

export type MediaUploadInput = Omit<
  InferInsertModel<typeof media>,
  "id" | "uploadedAt"
>;

export interface IFileService {
  upload(mediaInput: MediaUploadInput, file: File): Promise<void>;
  deleteFile(organizationId: string, fileName: string): Promise<void>;
  readFile(organizationId: string, fileName: string): Promise<Buffer>;
}

export function resolveFileService(): IFileService {
  const provider = process.env.FILE_SERVICE_PROVIDER;
  if (provider === "juno") {
    return JunoFileService;
  }
  return LocalFileService;
}

export const FileService: IFileService = resolveFileService();
