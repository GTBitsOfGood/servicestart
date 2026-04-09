import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import db from "@/lib/db";
import { media } from "@/lib/schema";
import {
  addMember,
  buildTestUser,
  createMedia,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";
import { FileService } from "@/lib/services/FileService";

vi.mock("@/lib/services/FileService", async () => {
  const { createMockFileService } =
    await import("@/tests/unit/mockFileService");
  return { FileService: createMockFileService() };
});

import { app } from "@/lib/app";

async function setupOrgAndUser(role: "owner" | "admin" | "member") {
  const organization = await createOrganization("acme");
  const testUser = buildTestUser();
  const { user, session, headers } = await signUpAndGetSession(testUser);
  await setActiveOrganization(session.id, organization.id);
  await addMember(user.id, organization.id, role);
  return { organization, user, session, headers };
}

function createFormDataWithFile(
  fileName: string,
  content: string,
  extras?: { title?: string; altText?: string },
) {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([content], { type: "image/jpeg" }),
    fileName,
  );
  if (extras?.title) formData.append("title", extras.title);
  if (extras?.altText !== undefined) formData.append("altText", extras.altText);
  return formData;
}

describe("POST /api/media", () => {
  it("returns 401 when not logged in", async () => {
    const formData = createFormDataWithFile("test.jpg", "content");

    const response = await app.request("/api/media", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 when user has no active organization", async () => {
    const testUser = buildTestUser();
    const { headers } = await signUpAndGetSession(testUser);
    const formData = createFormDataWithFile("test.jpg", "content");

    const response = await app.request("/api/media", {
      method: "POST",
      body: formData,
      headers: new Headers(headers),
    });

    expect(response.status).toBe(400);
  });

  it("returns 403 when user is not admin or owner", async () => {
    const { headers } = await setupOrgAndUser("member");
    const formData = createFormDataWithFile("test.jpg", "content");

    const response = await app.request("/api/media", {
      method: "POST",
      body: formData,
      headers: new Headers(headers),
    });

    expect(response.status).toBe(403);
  });

  it("returns 400 when file is missing", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const formData = new FormData();
    formData.append("title", "No file");

    const response = await app.request("/api/media", {
      method: "POST",
      body: formData,
      headers: new Headers(headers),
    });

    expect(response.status).toBe(400);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.error).toContain("File is required");
  });

  it("creates media record and saves file when admin", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const formData = createFormDataWithFile("uploaded.jpg", "file body", {
      title: "My Photo",
      altText: "A sunset",
    });

    const response = await app.request("/api/media", {
      method: "POST",
      body: formData,
      headers: new Headers(headers),
    });

    expect(response.status).toBe(201);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.title).toBe("My Photo");
    expect(typeof data.fileName).toBe("string");
    expect((data.fileName as string).length).toBeGreaterThan(0);
    expect(data.altText).toBe("A sunset");
    expect(data.organizationId).toBe(organization.id);
    expect(data.type).toBe("image");
    expect(data.uploadedAt).toBeDefined();
    expect(data.uploadUrl).toBe("https://blob.example/presigned");

    const [row] = await db
      .select()
      .from(media)
      .where(eq(media.id, data.id as typeof media.id));
    expect(row).toBeDefined();

    expect(FileService.getUploadPresignedUrl).toHaveBeenCalled();
  });
});

describe("GET /api/media (list)", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.media.$get({ query: {} });
    expect(response.status).toBe(401);
  });

  it("returns 400 when user has no active organization", async () => {
    const testUser = buildTestUser();
    const { headers } = await signUpAndGetSession(testUser);

    const response = await testApi.media.$get({ query: {} }, { headers });

    expect(response.status).toBe(400);
  });

  it("returns 403 when user is not admin or owner", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.media.$get({ query: {} }, { headers });

    expect(response.status).toBe(403);
  });

  it("returns paginated media for admin", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    await createMedia(organization.id, { title: "Media 1" });
    await createMedia(organization.id, { title: "Media 2" });

    const response = await testApi.media.$get(
      { query: { page: 1, pageSize: 10 } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.data).toHaveLength(2);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(10);
  });

  it("paginates correctly", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    await createMedia(organization.id, { title: "A" });
    await createMedia(organization.id, { title: "B" });
    await createMedia(organization.id, { title: "C" });

    const response = await testApi.media.$get(
      { query: { page: 1, pageSize: 2 } },
      { headers },
    );
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.data).toHaveLength(2);

    const response2 = await testApi.media.$get(
      { query: { page: 2, pageSize: 2 } },
      { headers },
    );
    const data2 = (await response2.json()) as Record<string, unknown>;
    expect(data2.data).toHaveLength(1);
    expect(data2.page).toBe(2);
  });

  it("returns only media for active organization", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization("other");
    await createMedia(organization.id, { title: "Ours" });
    await createMedia(otherOrg.id, { title: "Theirs" });

    const response = await testApi.media.$get({ query: {} }, { headers });

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.data).toHaveLength(1);
    expect((data.data as Record<string, unknown>[])[0].title).toBe("Ours");
  });
});

describe("GET /api/media/:id", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.media[":id"].$get({
      param: { id: "some-id" },
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when media does not exist", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.media[":id"].$get(
      { param: { id: "nonexistent" } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when user is not a member of the organization", async () => {
    const { headers } = await setupOrgAndUser("member");
    const otherOrg = await createOrganization("other");
    const mediaId = await createMedia(otherOrg.id, { title: "Their Media" });

    const response = await testApi.media[":id"].$get(
      { param: { id: mediaId } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns media for organization member", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const mediaId = await createMedia(organization.id, {
      title: "Shared Media",
      altText: "For members",
    });

    const response = await testApi.media[":id"].$get(
      { param: { id: mediaId } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.id).toBe(mediaId);
    expect(data.title).toBe("Shared Media");
    expect(data.altText).toBe("For members");
  });
});

describe("PATCH /api/media/:id", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.media[":id"].$patch({
      param: { id: "some-id" },
      json: { title: "Updated" },
    });
    expect(response.status).toBe(401);
  });

  it("returns 400 when user has no active organization", async () => {
    const testUser = buildTestUser();
    const { headers } = await signUpAndGetSession(testUser);
    const org = await createOrganization("patch-org");
    const mediaId = await createMedia(org.id);

    const response = await testApi.media[":id"].$patch(
      { param: { id: mediaId }, json: { title: "Updated" } },
      { headers },
    );

    expect(response.status).toBe(400);
  });

  it("returns 403 when user is not admin or owner", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const mediaId = await createMedia(organization.id);

    const response = await testApi.media[":id"].$patch(
      { param: { id: mediaId }, json: { title: "Updated" } },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 when media does not exist", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.media[":id"].$patch(
      { param: { id: "nonexistent" }, json: { title: "Updated" } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when media belongs to different organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization("other");
    const mediaId = await createMedia(otherOrg.id);

    const response = await testApi.media[":id"].$patch(
      { param: { id: mediaId }, json: { title: "Updated" } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("updates title and altText when admin", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const mediaId = await createMedia(organization.id, {
      title: "Original",
      altText: "Original alt",
    });

    const response = await testApi.media[":id"].$patch(
      {
        param: { id: mediaId },
        json: { title: "New Title", altText: "New alt" },
      },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.title).toBe("New Title");
    expect(data.altText).toBe("New alt");
  });
});

describe("DELETE /api/media/:id", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.media[":id"].$delete({
      param: { id: "some-id" },
    });
    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not admin or owner", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const mediaId = await createMedia(organization.id);

    const response = await testApi.media[":id"].$delete(
      { param: { id: mediaId } },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 when media does not exist", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.media[":id"].$delete(
      { param: { id: "nonexistent" } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when media belongs to different organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization("other");
    const mediaId = await createMedia(otherOrg.id);

    const response = await testApi.media[":id"].$delete(
      { param: { id: mediaId } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("deletes media record when admin (Juno delete not implemented)", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const mediaId = await createMedia(organization.id, {
      fileName: "to-delete.jpg",
    });

    const response = await testApi.media[":id"].$delete(
      { param: { id: mediaId } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);

    const rows = await db.select().from(media).where(eq(media.id, mediaId));
    expect(rows).toHaveLength(0);
    expect(FileService.deleteFile).toHaveBeenCalled();
  });
});
