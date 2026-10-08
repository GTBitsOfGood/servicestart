import { describe, expect, it, beforeEach, vi } from "vitest";
import { JunoFileService } from "@/lib/services/JunoFileService";
import { JunoFileDeletionNotSupportedError } from "@/lib/errors";

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

  it("upload PUTs the file to a presigned upload URL", async () => {
    const file = new File(["data"], "test.png", { type: "image/png" });

    await JunoFileService.upload(
      { organizationId: "org-1", fileName: "test.png" },
      file,
    );

    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "test.png" }),
    );
    expect(fetch).toHaveBeenCalledWith("https://upload.example/presigned", {
      method: "PUT",
      body: file,
      headers: { "Content-Type": "image/png", "x-ms-blob-type": "BlockBlob" },
    });
  });

  it("upload throws when the blob upload fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    await expect(
      JunoFileService.upload(
        { organizationId: "org-1", fileName: "test.png" },
        new File(["data"], "test.png", { type: "image/png" }),
      ),
    ).rejects.toThrow("Blob upload failed (403)");
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
