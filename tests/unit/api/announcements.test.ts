import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "@/lib/db";
import { announcements } from "@/lib/schema";
import { EmailService } from "@/lib/services/EmailService";
import {
  addMember,
  buildTestUser,
  createAnnouncement,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

vi.mock("@/lib/services/EmailService", () => ({
  EmailService: {
    emailMembers: vi.fn(async () => {}),
    registerOrganizationSender: vi.fn(async () => {}),
  },
}));

const mockEmailMembers = vi.mocked(EmailService.emailMembers);

beforeEach(() => {
  mockEmailMembers.mockReset();
  mockEmailMembers.mockResolvedValue(undefined);
});

async function setupOrgAndUser(role: "owner" | "admin" | "member") {
  const organization = await createOrganization("acme");
  const testUser = buildTestUser();
  const { user, session, headers } = await signUpAndGetSession(testUser);
  await setActiveOrganization(session.id, organization.id);
  await addMember(user.id, organization.id, role);
  return { organization, user, session, headers };
}

describe("POST /api/announcements", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.announcements.$post({
      json: {
        name: "Hello",
        content: [
          { type: "text/plain", value: "Hi" },
          { type: "text/html", value: "<p>Hi</p>" },
        ],
        subject: "Test",
        template: false,
        draft: false,
      },
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not admin or owner", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.announcements.$post(
      {
        json: {
          name: "Hello",
          content: [
            { type: "text/plain", value: "Hi" },
            { type: "text/html", value: "<p>Hi</p>" },
          ],
          subject: "Test",
          template: false,
          draft: false,
        },
      },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("creates an announcement linked to the active organization", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    const response = await testApi.announcements.$post(
      {
        json: {
          name: "Hello",
          content: [
            { type: "text/plain", value: "Hi" },
            { type: "text/html", value: "<p>Hi</p>" },
          ],
          subject: "Test",
          template: false,
          draft: false,
        },
      },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!("id" in data)) {
      throw new Error("Response data is missing 'id' property");
    }

    const [row] = await db
      .select()
      .from(announcements)
      .where(eq(announcements.id, data.id));
    expect(row).toBeDefined();
    expect(row.organizationId).toBe(organization.id);
    expect(row.name).toBe("Release Notes");
    expect(mockEmailMembers).toHaveBeenCalledTimes(1);
    expect(mockEmailMembers).toHaveBeenCalledWith(organization.id, {
      subject: "New announcement: Release Notes",
      textBody: "v1.0 is out",
    });
  });

  it("does not send emails when creating a draft announcement", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    const response = await testApi.announcements.$post(
      {
        json: {
          name: "Hello",
          content: [
            { type: "text/plain", value: "Hi" },
            { type: "text/html", value: "<p>Hi</p>" },
          ],
          subject: "Test",
          template: false,
          draft: true,
        },
      },
      { headers },
    );

    expect(response.status).toBe(200);
    expect(mockEmailMembers).not.toHaveBeenCalled();

    const rows = await db
      .select()
      .from(announcements)
      .where(eq(announcements.organizationId, organization.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].publishedAt).toBeNull();
  });
});

describe("GET /api/announcements (list)", () => {
  it("defaults to only published announcements when draft is not specified", async () => {
    const { organization, headers } = await setupOrgAndUser("member");

    await createAnnouncement(organization.id, {
      name: "Published",
      draft: false,
    });
    await createAnnouncement(organization.id, { name: "Draft", draft: true });

    const response = await testApi.announcements.$get(
      { query: {} },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Response data is not an array");
    }
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Published");
  });

  it("returns only draft announcements when draft=true for admin", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    await createAnnouncement(organization.id, {
      name: "Published",
      draft: false,
    });
    await createAnnouncement(organization.id, { name: "Draft", draft: true });

    const response = await testApi.announcements.$get(
      { query: { draft: "true" } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Response data is not an array");
    }
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Draft");
  });

  it("returns 403 when non-admin requests draft=true", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.announcements.$get(
      { query: { draft: "true" } },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("paginates results correctly", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    for (let i = 0; i < 3; i++) {
      await createAnnouncement(organization.id, { draft: false });
    }

    const response = await testApi.announcements.$get(
      { query: { page: 1, pageSize: 2 } },
      { headers },
    );
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Response data is not an array");
    }
    expect(data).toHaveLength(2);

    const response2 = await testApi.announcements.$get(
      { query: { page: 2, pageSize: 2 } },
      { headers },
    );
    const data2 = await response2.json();
    if (!Array.isArray(data2)) {
      throw new Error("Response data is not an array");
    }
    expect(data2).toHaveLength(1);
  });
});

describe("GET /api/announcements/:announcementId", () => {
  it("returns 404 when announcement does not exist", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.announcements[":announcementId"].$get(
      { param: { announcementId: "nonexistent" } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when draft and user is not admin or owner", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const announcementId = await createAnnouncement(organization.id, {
      draft: true,
    });

    const response = await testApi.announcements[":announcementId"].$get(
      { param: { announcementId } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns a published announcement to a regular member", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const announcementId = await createAnnouncement(organization.id, {
      name: "Visible",
      draft: false,
    });

    const response = await testApi.announcements[":announcementId"].$get(
      { param: { announcementId } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!("name" in data)) {
      throw new Error("Response data is missing 'name' property");
    }
    expect(data.name).toBe("Visible");
  });

  it("returns a draft announcement to an admin", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const announcementId = await createAnnouncement(organization.id, {
      name: "Admin Draft",
      draft: true,
    });

    const response = await testApi.announcements[":announcementId"].$get(
      { param: { announcementId } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!("name" in data)) {
      throw new Error("Response data is missing 'name' property");
    }
    expect(data.name).toBe("Admin Draft");
  });
});

describe("PATCH /api/announcements/:announcementId", () => {
  it("returns 403 when user is not admin or owner", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const announcementId = await createAnnouncement(organization.id, {
      draft: false,
    });

    const response = await testApi.announcements[":announcementId"].$patch(
      { param: { announcementId }, json: { name: "Updated" } },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("updates name and body without requiring all fields", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const announcementId = await createAnnouncement(organization.id, {
      name: "Original",
      body: "Original body",
      draft: false,
    });

    const response = await testApi.announcements[":announcementId"].$patch(
      { param: { announcementId }, json: { name: "Updated Name" } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!("name" in data)) {
      throw new Error("Response data is missing 'name' property");
    }
    expect(data.name).toBe("Updated Name");
  });

  it("sets publishedAt and publishedBy when draft changes from false to true", async () => {
    const { organization, user, headers } = await setupOrgAndUser("admin");
    const announcementId = await createAnnouncement(organization.id, {
      draft: false,
    });

    const response = await testApi.announcements[":announcementId"].$patch(
      { param: { announcementId }, json: { draft: true } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!("publishedAt" in data)) {
      throw new Error("Response data is missing 'publishedAt' property");
    }
    expect(data.publishedAt).not.toBeNull();
    expect(data.publishedById).toBe(user.id);
  });

  it("clears publishedAt and publishedBy when draft changes from true to false", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const announcementId = await createAnnouncement(organization.id, {
      draft: true,
    });

    const response = await testApi.announcements[":announcementId"].$patch(
      { param: { announcementId }, json: { draft: false } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!("publishedAt" in data)) {
      throw new Error("Response data is missing 'publishedAt' property");
    }
    expect(data.publishedAt).toBeNull();
    expect(data.publishedById).toBeNull();
  });

  it("does not change publish state when draft is not provided", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const announcementId = await createAnnouncement(organization.id, {
      draft: true,
    });

    const [before] = await db
      .select()
      .from(announcements)
      .where(eq(announcements.id, announcementId));

    await testApi.announcements[":announcementId"].$patch(
      { param: { announcementId }, json: { name: "Renamed" } },
      { headers },
    );

    const [after] = await db
      .select()
      .from(announcements)
      .where(eq(announcements.id, announcementId));
    expect(after.publishedAt).toEqual(before.publishedAt);
    expect(after.publishedById).toEqual(before.publishedById);
    expect(mockEmailMembers).not.toHaveBeenCalled();
  });

  it("sends announcement email when announcement transitions to published", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const announcementId = await createAnnouncement(organization.id, {
      name: "Draft Announcement",
      body: "Publish me",
      draft: true,
    });

    const response = await testApi.announcements[":announcementId"].$patch(
      { param: { announcementId }, json: { draft: true } },
      { headers },
    );

    expect(response.status).toBe(200);
    expect(mockEmailMembers).toHaveBeenCalledTimes(1);
    expect(mockEmailMembers).toHaveBeenCalledWith(organization.id, {
      subject: "New announcement: Draft Announcement",
      textBody: "Publish me",
    });
  });
});

describe("DELETE /api/announcements/:announcementId", () => {
  it("returns 403 when user is not admin or owner", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const announcementId = await createAnnouncement(organization.id, {
      draft: false,
    });

    const response = await testApi.announcements[":announcementId"].$delete(
      { param: { announcementId } },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("deletes the announcement", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const announcementId = await createAnnouncement(organization.id, {
      draft: false,
    });

    const response = await testApi.announcements[":announcementId"].$delete(
      { param: { announcementId } },
      { headers },
    );

    expect(response.status).toBe(200);

    const rows = await db
      .select()
      .from(announcements)
      .where(eq(announcements.id, announcementId));
    expect(rows).toHaveLength(0);
  });

  it("returns 404 when announcement belongs to different organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization("other");
    const announcementId = await createAnnouncement(otherOrg.id, {
      draft: false,
    });

    const response = await testApi.announcements[":announcementId"].$delete(
      { param: { announcementId } },
      { headers },
    );

    expect(response.status).toBe(404);
  });
});
