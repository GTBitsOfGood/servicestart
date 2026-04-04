import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { LocalFileService } from "@/lib/services/LocalFileService";

const TEST_STORAGE_DIR = "/tmp/servicestart-media-test";

function createMockFile(content: string, name: string): File {
  return {
    name,
    async arrayBuffer() {
      return new TextEncoder().encode(content).buffer;
    },
  } as File;
}

describe("LocalFileService", () => {
  beforeEach(() => {
    process.env.FILE_STORAGE_DIR = TEST_STORAGE_DIR;
  });

  describe("upload", () => {
    it("saves file to organizationId/fileName path", async () => {
      const mediaInput = {
        organizationId: "org-local-123",
        fileName: "test-upload.jpg",
      };
      const file = createMockFile("file content here", "test-upload.jpg");

      await LocalFileService.upload(mediaInput, file);

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
        organizationId: "org-local-123",
        fileName: "test.jpg",
      };
      const file = createMockFile("x", "test.jpg");

      await expect(LocalFileService.upload(mediaInput, file)).rejects.toThrow(
        "FILE_STORAGE_DIR environment variable is not set",
      );

      process.env.FILE_STORAGE_DIR = original;
    });
  });

  describe("deleteFile", () => {
    it("removes the file from disk", async () => {
      const mediaInput = {
        organizationId: "org-local-delete",
        fileName: "delete-me.jpg",
      };
      const file = createMockFile("delete me", "delete-me.jpg");
      await LocalFileService.upload(mediaInput, file);

      const filePath = path.join(
        TEST_STORAGE_DIR,
        mediaInput.organizationId,
        mediaInput.fileName,
      );
      expect(existsSync(filePath)).toBe(true);

      await LocalFileService.deleteFile(
        mediaInput.organizationId,
        mediaInput.fileName,
      );

      expect(existsSync(filePath)).toBe(false);
    });

    it("does not throw when file does not exist (ENOENT)", async () => {
      await expect(
        LocalFileService.deleteFile("org-nonexistent", "missing.jpg"),
      ).resolves.not.toThrow();
    });

    it("throws when FILE_STORAGE_DIR is not set", async () => {
      const original = process.env.FILE_STORAGE_DIR;
      delete process.env.FILE_STORAGE_DIR;

      await expect(
        LocalFileService.deleteFile("org-local-123", "test.jpg"),
      ).rejects.toThrow("FILE_STORAGE_DIR environment variable is not set");

      process.env.FILE_STORAGE_DIR = original;
    });
  });

  describe("readFile", () => {
    it("reads file content", async () => {
      const mediaInput = {
        organizationId: "org-local-read",
        fileName: "read-me.txt",
      };
      const file = createMockFile("readable content", "read-me.txt");
      await LocalFileService.upload(mediaInput, file);

      const buffer = await LocalFileService.readFile(
        mediaInput.organizationId,
        mediaInput.fileName,
      );
      expect(buffer.toString("utf-8")).toBe("readable content");
    });
  });
});
