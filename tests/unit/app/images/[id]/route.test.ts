import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addMember,
  buildTestUser,
  createMedia,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";
import { GET } from "@/app/images/[id]/route";

const FILE_STORAGE_DIR =
  process.env.FILE_STORAGE_DIR ?? "/tmp/servicestart-media-test";

async function setupOrgAndUser(role: "owner" | "admin" | "member") {
  const organization = await createOrganization("acme");
  const testUser = buildTestUser();
  const { user, session, headers } = await signUpAndGetSession(testUser);
  await setActiveOrganization(session.id, organization.id);
  await addMember(user.id, organization.id, role);
  return { organization, user, session, headers };
}

describe("GET /images/:id", () => {
  it("returns 401 when not logged in", async () => {
    const org = await createOrganization("images-401");
    const mediaId = await createMedia(org.id);

    const request = new Request(`http://localhost/images/${mediaId}`);
    const response = await GET(request, {
      params: Promise.resolve({ id: mediaId }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when media does not exist", async () => {
    const { headers } = await setupOrgAndUser("member");

    const request = new Request("http://localhost/images/nonexistent", {
      headers: new Headers(headers),
    });
    const response = await GET(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 when user is not a member of the organization", async () => {
    const { headers } = await setupOrgAndUser("member");
    const otherOrg = await createOrganization("other");
    const mediaId = await createMedia(otherOrg.id, { fileName: "their.jpg" });

    const filePath = path.join(FILE_STORAGE_DIR, otherOrg.id, "their.jpg");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "image bytes");

    const request = new Request(`http://localhost/images/${mediaId}`, {
      headers: new Headers(headers),
    });
    const response = await GET(request, {
      params: Promise.resolve({ id: mediaId }),
    });

    expect(response.status).toBe(404);
  });

  it("returns image file for organization member", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const mediaId = await createMedia(organization.id, {
      fileName: "member-image.jpg",
    });

    const filePath = path.join(
      FILE_STORAGE_DIR,
      organization.id,
      "member-image.jpg",
    );
    await mkdir(path.dirname(filePath), { recursive: true });
    const imageContent = "binary image data here";
    await writeFile(filePath, imageContent);

    const request = new Request(`http://localhost/images/${mediaId}`, {
      headers: new Headers(headers),
    });
    const response = await GET(request, {
      params: Promise.resolve({ id: mediaId }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    const body = await response.arrayBuffer();
    expect(new TextDecoder().decode(body)).toBe(imageContent);
  });

  it("returns 404 when file does not exist on disk", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const mediaId = await createMedia(organization.id, {
      fileName: "missing-on-disk.jpg",
    });
    // Don't create the file - media record exists but file doesn't

    const request = new Request(`http://localhost/images/${mediaId}`, {
      headers: new Headers(headers),
    });
    const response = await GET(request, {
      params: Promise.resolve({ id: mediaId }),
    });

    expect(response.status).toBe(404);
  });
});
