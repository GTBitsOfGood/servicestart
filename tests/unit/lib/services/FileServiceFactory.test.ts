import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveFileService } from "@/lib/services/FileService";
import { LocalFileService } from "@/lib/services/LocalFileService";
import { JunoFileService } from "@/lib/services/JunoFileService";

describe("resolveFileService", () => {
  let originalProvider: string | undefined;

  beforeEach(() => {
    originalProvider = process.env.FILE_SERVICE_PROVIDER;
  });

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.FILE_SERVICE_PROVIDER;
    } else {
      process.env.FILE_SERVICE_PROVIDER = originalProvider;
    }
  });

  it("returns LocalFileService when FILE_SERVICE_PROVIDER is unset", () => {
    delete process.env.FILE_SERVICE_PROVIDER;
    const service = resolveFileService();
    expect(service).toBe(LocalFileService);
  });

  it("returns LocalFileService when FILE_SERVICE_PROVIDER is 'local'", () => {
    process.env.FILE_SERVICE_PROVIDER = "local";
    const service = resolveFileService();
    expect(service).toBe(LocalFileService);
  });

  it("returns JunoFileService when FILE_SERVICE_PROVIDER is 'juno'", () => {
    process.env.FILE_SERVICE_PROVIDER = "juno";
    const service = resolveFileService();
    expect(service).toBe(JunoFileService);
  });

  it("defaults to LocalFileService for unknown provider values", () => {
    process.env.FILE_SERVICE_PROVIDER = "unknown";
    const service = resolveFileService();
    expect(service).toBe(LocalFileService);
  });
});
