import { describe, expect, it } from "vitest";
import { JunoFileService } from "@/lib/services/JunoFileService";

function createMockFile(content: string, name: string): File {
  return {
    name,
    async arrayBuffer() {
      return new TextEncoder().encode(content).buffer;
    },
  } as File;
}

describe("JunoFileService", () => {
  it("upload throws not implemented", async () => {
    const mediaInput = { organizationId: "org-1", fileName: "test.jpg" };
    const file = createMockFile("data", "test.jpg");

    await expect(JunoFileService.upload(mediaInput, file)).rejects.toThrow(
      "JunoFileService is not implemented",
    );
  });

  it("deleteFile throws not implemented", async () => {
    await expect(
      JunoFileService.deleteFile("org-1", "test.jpg"),
    ).rejects.toThrow("JunoFileService is not implemented");
  });

  it("readFile throws not implemented", async () => {
    await expect(JunoFileService.readFile("org-1", "test.jpg")).rejects.toThrow(
      "JunoFileService is not implemented",
    );
  });
});
