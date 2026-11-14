// @vitest-environment node
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import db from "@/core/db";
import { members, users } from "@/core/db/schema";
import { FileService } from "@/core/files/FileService";
import serveImage from "@/core/files/api/serveImage";
import { app } from "@/features/app";
import {
  addMember,
  buildHost,
  buildTestUser,
  createMedia,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

vi.mock("@/core/files/FileService", async () => {
  const { createMockFileService } =
    await import("@/tests/unit/mockFileService");
  return { FileService: createMockFileService() };
});

async function profileInAnotherOrganization() {
  vi.mocked(FileService.readFile).mockReset();
  vi.mocked(FileService.readFile).mockResolvedValue(Buffer.from("photo"));
  const source = await createOrganization("photo-source");
  const current = await createOrganization("photo-current");
  const { user, session, headers } = await signUpAndGetSession(
    buildTestUser(),
    source.slug,
  );
  await addMember(user.id, source.id, "member");
  await addMember(user.id, current.id, "member");
  const imageId = await createMedia(source.id, { fileName: "avatar.png" });
  await db
    .update(users)
    .set({ image: `/images/${imageId}` })
    .where(eq(users.id, user.id));
  await setActiveOrganization(session.id, current.id);
  return {
    source,
    current,
    user,
    imageId,
    headers: { ...headers, host: buildHost(current.slug) },
  };
}

describe("cross-organization profile photos", () => {
  it("keeps the owner's assigned photo readable after switching without exposing the media record", async () => {
    const { source, imageId, headers } = await profileInAnotherOrganization();
    const response = await serveImage.request(`/images/${imageId}`, {
      headers,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(await response.text()).toBe("photo");
    expect(FileService.readFile).toHaveBeenCalledWith(source.id, "avatar.png");
    expect(
      (await app.request(`/api/media/${imageId}`, { headers })).status,
    ).toBe(404);
  });

  it("does not allow unassigned library images from another organization", async () => {
    const { source, headers } = await profileInAnotherOrganization();
    const libraryImage = await createMedia(source.id);
    expect(
      (await serveImage.request(`/images/${libraryImage}`, { headers })).status,
    ).toBe(404);
    expect(FileService.readFile).not.toHaveBeenCalled();
  });

  it.each(["source", "current"] as const)(
    "requires the owner to retain membership in the %s organization",
    async (which) => {
      const fixture = await profileInAnotherOrganization();
      await db
        .delete(members)
        .where(
          and(
            eq(members.userId, fixture.user.id),
            eq(members.organizationId, fixture[which].id),
          ),
        );
      expect(
        (
          await serveImage.request(`/images/${fixture.imageId}`, {
            headers: fixture.headers,
          })
        ).status,
      ).toBe(404);
      expect(FileService.readFile).not.toHaveBeenCalled();
    },
  );

  it("does not let profile images bypass a conflicting host and active organization", async () => {
    const { source, imageId, headers } = await profileInAnotherOrganization();
    expect(
      (
        await serveImage.request(`/images/${imageId}`, {
          headers: { ...headers, host: buildHost(source.slug) },
        })
      ).status,
    ).toBe(403);
  });

  it("logs unexpected file failures and preserves the JSON failure message", async () => {
    const { imageId, headers } = await profileInAnotherOrganization();
    const error = new Error("Storage unavailable");
    vi.mocked(FileService.readFile).mockRejectedValueOnce(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await serveImage.request(`/images/${imageId}`, {
        headers,
      });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Failed to load image" });
      expect(log).toHaveBeenCalledWith(error);
    } finally {
      log.mockRestore();
    }
  });
});
