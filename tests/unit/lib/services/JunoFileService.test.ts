import { describe, expect, it, beforeEach, vi } from "vitest";
import { JunoFileService } from "@/lib/services/JunoFileService";
import { JunoFileDeletionNotSupportedError } from "@/lib/errors";
import { MediaType } from "@/lib/schema";

const { uploadFile, downloadFile, getConfig } = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  getConfig: vi.fn(),
}));

vi.mock("@/lib/junoClient", () => ({
  juno: {
    file: {
      uploadFile,
      downloadFile,
      getConfig,
    },
  },
}));

function createMockFile(content: string, name: string): File {
  return {
    name,
    async arrayBuffer() {
      return new TextEncoder().encode(content).buffer;
    },
  } as File;
}

describe("JunoFileService", () => {
  beforeEach(() => {
    process.env.FILE_SERVICE_IMPLEMENTATION = "juno";
    process.env.FILE_PROVIDER_NAME = "test-provider";
    process.env.JUNO_PROJECT_ID = "42";
    process.env.JUNO_FILE_BUCKET_PREFIX = "ServiceStart";
    getConfig.mockResolvedValue({ id: 42 });
    uploadFile.mockResolvedValue({ url: "https://upload.example/presigned" });
    downloadFile.mockResolvedValue({ url: "https://download.example/blob" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
    }) as unknown as typeof fetch;
  });

  it("upload rejects direct multipart upload", async () => {
    const mediaInput = {
      organizationId: "org-1",
      fileName: "test.jpg",
      title: "t",
      type: MediaType.Image,
      altText: "",
    };
    const file = createMockFile("data", "test.jpg");

    await expect(JunoFileService.upload(mediaInput, file)).rejects.toThrow(
      "Direct upload is not supported with JunoFileService",
    );
  });

  it("deleteFile throws JunoFileDeletionNotSupportedError", async () => {
    await expect(
      JunoFileService.deleteFile("org-1", "test.jpg"),
    ).rejects.toBeInstanceOf(JunoFileDeletionNotSupportedError);
  });

  it("readFile fetches blob bytes via presigned download URL", async () => {
    const buf = await JunoFileService.readFile("org-1", "test.jpg");

    expect(downloadFile).toHaveBeenCalled();
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.equals(Buffer.from([9, 8, 7]))).toBe(true);
  });
});
