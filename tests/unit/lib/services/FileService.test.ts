import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { FileService, resolveFileService } from "@/lib/services/FileService";
import { LocalFileService } from "@/lib/services/LocalFileService";
import { JunoFileService } from "@/lib/services/JunoFileService";

const TEST_STORAGE_DIR = "/tmp/servicestart-media-test";

function createMockFile(content: string, name: string): File {
  return {
    name,
    async arrayBuffer() {
      return new TextEncoder().encode(content).buffer;
    },
  } as File;
}

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

describe("FileService", () => {
  beforeEach(() => {
    process.env.FILE_STORAGE_DIR = TEST_STORAGE_DIR;
  });

  describe("upload", () => {
    it("saves file to organizationId/fileName path", async () => {
      const mediaInput = {
        organizationId: "org-123",
        title: "Test",
        fileName: "test-upload.jpg",
        type: "image" as const,
        altText: "",
      };
      const file = createMockFile("file content here", "test-upload.jpg");

      await FileService.upload(mediaInput, file);

      const filePath = path.join(
        TEST_STORAGE_DIR,
        mediaInput.organizationId,
        mediaInput.fileName,
      );
      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, "utf-8")).toBe("file content here");
    });

    it("throws when FILE_STORAGE_DIR is not set", async () => {
      const original = process.env.FILE_STORAGE_DIR;
      delete process.env.FILE_STORAGE_DIR;

      const mediaInput = {
        organizationId: "org-123",
        title: "Test",
        fileName: "test.jpg",
        type: "image" as const,
        altText: "",
      };
      const file = createMockFile("x", "test.jpg");

      await expect(FileService.upload(mediaInput, file)).rejects.toThrow(
        "FILE_STORAGE_DIR environment variable is not set",
      );

      process.env.FILE_STORAGE_DIR = original;
    });
  });

  describe("deleteFile", () => {
    it("removes the file from disk", async () => {
      const mediaInput = {
        organizationId: "org-delete",
        title: "To Delete",
        fileName: "delete-me.jpg",
        type: "image" as const,
        altText: "",
      };
      const file = createMockFile("delete me", "delete-me.jpg");
      await FileService.upload(mediaInput, file);

      const filePath = path.join(
        TEST_STORAGE_DIR,
        mediaInput.organizationId,
        mediaInput.fileName,
      );
      expect(existsSync(filePath)).toBe(true);

      await FileService.deleteFile(
        mediaInput.organizationId,
        mediaInput.fileName,
      );

      expect(existsSync(filePath)).toBe(false);
    });

    it("does not throw when file does not exist (ENOENT)", async () => {
      await expect(
        FileService.deleteFile("org-nonexistent", "missing.jpg"),
      ).resolves.not.toThrow();
    });

    it("throws when FILE_STORAGE_DIR is not set", async () => {
      const original = process.env.FILE_STORAGE_DIR;
      delete process.env.FILE_STORAGE_DIR;

      await expect(
        FileService.deleteFile("org-123", "test.jpg"),
      ).rejects.toThrow("FILE_STORAGE_DIR environment variable is not set");

      process.env.FILE_STORAGE_DIR = original;
    });
  });

  describe("readFile", () => {
    it("reads file content", async () => {
      const mediaInput = {
        organizationId: "org-read",
        title: "Read Test",
        fileName: "read-me.txt",
        type: "image" as const,
        altText: "",
      };
      const file = createMockFile("readable content", "read-me.txt");
      await FileService.upload(mediaInput, file);

      const buffer = await FileService.readFile(
        mediaInput.organizationId,
        mediaInput.fileName,
      );
      expect(buffer.toString("utf-8")).toBe("readable content");
    });
  });
});
