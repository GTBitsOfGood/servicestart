import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { resolveFileService } from "@/lib/services/FileService";
import { LocalFileService } from "@/lib/services/LocalFileService";
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

describe("resolveFileService", () => {
  let originalImplementation: string | undefined;

  beforeEach(() => {
    originalImplementation = process.env.FILE_SERVICE_IMPLEMENTATION;
  });

  afterEach(() => {
    if (originalImplementation === undefined) {
      delete process.env.FILE_SERVICE_IMPLEMENTATION;
    } else {
      process.env.FILE_SERVICE_IMPLEMENTATION = originalImplementation;
    }
  });

  it("returns LocalFileService when FILE_SERVICE_IMPLEMENTATION is unset", () => {
    delete process.env.FILE_SERVICE_IMPLEMENTATION;
    const service = resolveFileService();
    expect(service).toBe(LocalFileService);
  });

  it("returns LocalFileService when FILE_SERVICE_IMPLEMENTATION is 'local'", () => {
    process.env.FILE_SERVICE_IMPLEMENTATION = "local";
    const service = resolveFileService();
    expect(service).toBe(LocalFileService);
  });

  it("returns JunoFileService when FILE_SERVICE_IMPLEMENTATION is 'juno'", () => {
    process.env.FILE_SERVICE_IMPLEMENTATION = "juno";
    const service = resolveFileService();
    expect(service).toBe(JunoFileService);
  });

  it("defaults to LocalFileService for unknown provider values", () => {
    process.env.FILE_SERVICE_IMPLEMENTATION = "unknown";
    const service = resolveFileService();
    expect(service).toBe(LocalFileService);
  });
});

describe("FileService (Juno implementation)", () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env.FILE_SERVICE_IMPLEMENTATION = "juno";
    process.env.FILE_PROVIDER_NAME = "test-provider";
    process.env.JUNO_PROJECT_ID = "42";
    uploadFile.mockReset();
    downloadFile.mockReset();
    getConfig.mockReset();
    getConfig.mockResolvedValue({ id: 42 });
    uploadFile.mockResolvedValue({ url: "https://upload.example/presigned" });
    downloadFile.mockResolvedValue({ url: "https://download.example/sas" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.JUNO_FILE_BUCKET_PREFIX;
    delete process.env.JUNO_PROJECT_ID;
    delete process.env.FILE_SERVICE_IMPLEMENTATION;
  });

  async function getFileService() {
    const mod = await import("@/lib/services/FileService");
    return mod.FileService;
  }

  it("getBucketName uses prefix and lowercases org id", async () => {
    const FileService = await getFileService();
    process.env.JUNO_FILE_BUCKET_PREFIX = "ServiceStart";
    expect(FileService.getBucketName("ABC-Org-ID")).toBe(
      "servicestart-orgabcorgid",
    );
  });

  it("getUploadPresignedUrl calls Juno uploadFile", async () => {
    const FileService = await getFileService();
    const result = await FileService.getUploadPresignedUrl("org-1", "a.jpg");

    expect(result.url).toBe("https://upload.example/presigned");
    expect(uploadFile).toHaveBeenCalledWith({
      fileName: "a.jpg",
      bucketName: "servicestart-orgorg1",
      providerName: "test-provider",
      configId: 42,
    });
  });

  it("throws when FILE_PROVIDER_NAME is missing", async () => {
    delete process.env.FILE_PROVIDER_NAME;
    vi.resetModules();
    const { FileService } = await import("@/lib/services/FileService");

    await expect(
      FileService.getUploadPresignedUrl("org-1", "a.jpg"),
    ).rejects.toThrow("FILE_PROVIDER_NAME");

    process.env.FILE_PROVIDER_NAME = "test-provider";
  });

  it("readFile downloads via presigned URL", async () => {
    const FileService = await getFileService();
    const buf = await FileService.readFile("org-1", "a.jpg");

    expect(downloadFile).toHaveBeenCalled();
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it("delete throws JunoFileDeletionNotSupportedError", async () => {
    const FileService = await getFileService();
    await expect(
      FileService.deleteFile("org-1", "a.jpg"),
    ).rejects.toBeInstanceOf(JunoFileDeletionNotSupportedError);
  });
});
