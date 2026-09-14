// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailService } from "@/lib/services/EmailService";
import {
  addMember,
  buildTestUser,
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

/** The single plain-text entry handed to Juno. */
function sentBody() {
  const payload = mockEmailMembers.mock.calls[0]?.[1];
  expect(payload?.content).toHaveLength(1);
  expect(payload?.content[0]?.type).toBe("text/plain");
  return payload!.content[0]!.value;
}

describe("POST /api/emails", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.emails.$post({
      json: { subject: "Hi", body: "Hello", recipientIds: [] },
    });

    expect(response.status).toBe(401);
    expect(mockEmailMembers).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not an admin", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.emails.$post(
      { json: { subject: "Hi", body: "Hello", recipientIds: [] } },
      { headers },
    );

    expect(response.status).toBe(403);
    expect(mockEmailMembers).not.toHaveBeenCalled();
  });

  it("includes the subtitle and footer in the delivered email", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    const response = await testApi.emails.$post(
      {
        json: {
          subject: "Spring Newsletter",
          subtitle: "A note from our director",
          body: "Thanks for volunteering with us this season.",
          footer: "Unsubscribe by replying to this email.",
          recipientIds: [],
        },
      },
      { headers },
    );

    expect(response.status).toBe(200);
    expect(mockEmailMembers).toHaveBeenCalledTimes(1);
    expect(mockEmailMembers.mock.calls[0]?.[0]).toBe(organization.id);

    const payload = mockEmailMembers.mock.calls[0]?.[1];
    expect(payload?.subject).toBe("Spring Newsletter");

    const value = sentBody();
    expect(value).toContain("A note from our director");
    expect(value).toContain("Thanks for volunteering with us this season.");
    expect(value).toContain("Unsubscribe by replying to this email.");
  });

  it("orders the sections subtitle, body, then footer", async () => {
    const { headers } = await setupOrgAndUser("admin");

    await testApi.emails.$post(
      {
        json: {
          subject: "Headline",
          subtitle: "SUBTITLE",
          body: "BODY",
          footer: "FOOTER",
          recipientIds: [],
        },
      },
      { headers },
    );

    expect(sentBody()).toBe("SUBTITLE\n\nBODY\n\nFOOTER");
  });

  it("produces no empty sections when only the required fields are sent", async () => {
    const { headers } = await setupOrgAndUser("admin");

    await testApi.emails.$post(
      {
        json: {
          subject: "Headline",
          body: "Just the body.",
          recipientIds: [],
        },
      },
      { headers },
    );

    const value = sentBody();
    expect(value).toBe("Just the body.");
    expect(value).not.toMatch(/\n\n\n/);
    expect(value).toBe(value.trim());
  });

  it("treats whitespace-only optional fields as absent", async () => {
    const { headers } = await setupOrgAndUser("admin");

    await testApi.emails.$post(
      {
        json: {
          subject: "Headline",
          subtitle: "   ",
          body: "Just the body.",
          footer: "\n  \n",
          recipientIds: [],
        },
      },
      { headers },
    );

    expect(sentBody()).toBe("Just the body.");
  });

  it("forwards the selected recipients to the service", async () => {
    const { headers } = await setupOrgAndUser("admin");

    await testApi.emails.$post(
      {
        json: {
          subject: "Headline",
          body: "Body",
          recipientIds: ["user-1", "user-2"],
        },
      },
      { headers },
    );

    expect(mockEmailMembers.mock.calls[0]?.[1]?.targetUserIds).toEqual([
      "user-1",
      "user-2",
    ]);
  });

  it("scopes the send to the caller's active organization", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const otherOrganization = await createOrganization("other-org");

    await testApi.emails.$post(
      {
        json: {
          subject: "Headline",
          subtitle: "Subtitle",
          body: "Body",
          footer: "Footer",
          recipientIds: [],
        },
      },
      { headers },
    );

    expect(mockEmailMembers.mock.calls[0]?.[0]).toBe(organization.id);
    expect(mockEmailMembers.mock.calls[0]?.[0]).not.toBe(otherOrganization.id);
  });
});
