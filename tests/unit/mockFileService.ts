import { vi } from "vitest";
import { JunoFileDeletionNotSupportedError } from "@/lib/errors";

export type MockedFileService = {
  getBucketName: ReturnType<typeof vi.fn>;
  getUploadPresignedUrl: ReturnType<typeof vi.fn>;
  getDownloadPresignedUrl: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

/**
 * Default mock implementation for {@link FileService} in API and route tests.
 * Override individual methods with `vi.mocked(FileService.readFile).mockResolvedValueOnce(...)` as needed.
 */
export function createMockFileService(
  overrides: Partial<MockedFileService> = {},
): MockedFileService {
  return {
    getBucketName: vi.fn((orgName: string) => {
      const sanitized = orgName.replace(/[^a-zA-Z0-9]/g, "");
      return `servicestart-org${sanitized.toLowerCase()}`;
    }),
    getUploadPresignedUrl: vi
      .fn()
      .mockResolvedValue({ url: "https://blob.example/presigned" }),
    getDownloadPresignedUrl: vi
      .fn()
      .mockResolvedValue({ url: "https://blob.example/download-presigned" }),
    readFile: vi.fn().mockResolvedValue(Buffer.from("file body")),
    delete: vi.fn().mockRejectedValue(new JunoFileDeletionNotSupportedError()),
    ...overrides,
  };
}
