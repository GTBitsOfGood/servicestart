// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { juno } from "@/lib/junoClient";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

vi.mock("@/lib/junoClient", () => ({
  juno: {
    email: {
      sendEmail: vi.fn(async () => ({ success: true })),
      registerSenderAddress: vi.fn(async () => ({ statusCode: 201 })),
    },
  },
}));

const mockSendEmail = vi.mocked(juno.email.sendEmail);
const previousSenderDomain = process.env.EMAIL_SENDER_DOMAIN;

async function setupOrgAndUser(role: "owner" | "admin" | "member") {
  const organization = await createOrganization(
    `emails-api-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  );
  const testUser = buildTestUser();
  const { user, session, headers } = await signUpAndGetSession(testUser);
  await setActiveOrganization(session.id, organization.id);
  await addMember(user.id, organization.id, role);
  return { organization, user, session, headers };
}

const validEmail = {
  subject: "Board update",
  body: "Please review the notes.",
};

describe("POST /api/emails", () => {
  beforeEach(() => {
    process.env.EMAIL_SENDER_DOMAIN = "notifications.test";
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ success: true });
  });

  afterAll(() => {
    if (previousSenderDomain === undefined) {
      delete process.env.EMAIL_SENDER_DOMAIN;
    } else {
      process.env.EMAIL_SENDER_DOMAIN = previousSenderDomain;
    }
  });

  it("returns 401 when not logged in", async () => {
    const response = await testApi.emails.$post({
      json: { ...validEmail, recipientIds: ["someone"] },
    });

    expect(response.status).toBe(401);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not an admin or owner", async () => {
    const { user, headers } = await setupOrgAndUser("member");

    const response = await testApi.emails.$post(
      { json: { ...validEmail, recipientIds: [user.id] } },
      { headers },
    );

    expect(response.status).toBe(403);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when subject, body, or recipients are empty", async () => {
    const { user, headers } = await setupOrgAndUser("admin");

    const missingSubject = await testApi.emails.$post(
      { json: { subject: "   ", body: "Hello", recipientIds: [user.id] } },
      { headers },
    );
    const missingBody = await testApi.emails.$post(
      { json: { subject: "Hello", body: " ", recipientIds: [user.id] } },
      { headers },
    );
    const missingRecipients = await testApi.emails.$post(
      { json: { ...validEmail, recipientIds: [] } },
      { headers },
    );

    expect(missingSubject.status).toBe(400);
    expect(missingBody.status).toBe(400);
    expect(missingRecipients.status).toBe(400);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends only to members of the active organization", async () => {
    const { organization, user, headers } = await setupOrgAndUser("owner");
    const otherOrg = await createOrganization(
      `emails-other-org-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    );
    const outsider = buildTestUser();
    const { user: outsiderUser } = await signUpAndGetSession(outsider);
    await addMember(outsiderUser.id, otherOrg.id, "member");

    const response = await testApi.emails.$post(
      {
        json: {
          subject: "  Hello team  ",
          subtitle: "Weekly",
          body: "Thanks for coming.",
          footer: "Service Start",
          recipientIds: [user.id, outsiderUser.id],
        },
      },
      { headers },
    );

    expect(response.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const payload = mockSendEmail.mock.calls[0]?.[0];
    expect(payload?.subject).toBe("Hello team");
    expect(payload?.contents).toEqual([
      {
        type: "text/plain",
        value: "Weekly\n\nThanks for coming.\n\nService Start",
      },
    ]);
    expect(payload?.recipients).toEqual([
      { email: user.email.toLowerCase(), name: user.name },
    ]);
    expect(organization.id).not.toBe(otherOrg.id);
  });

  it("returns 400 when every recipient belongs to another organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization(
      `emails-foreign-only-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    );
    const outsider = buildTestUser();
    const { user: outsiderUser } = await signUpAndGetSession(outsider);
    await addMember(outsiderUser.id, otherOrg.id, "member");

    const response = await testApi.emails.$post(
      { json: { ...validEmail, recipientIds: [outsiderUser.id] } },
      { headers },
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toMatch(/organization/i);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it.each(["unsuccessful result", "rejected request"])(
    "returns a failure when delivery reports an %s",
    async (failure) => {
      const { user, headers } = await setupOrgAndUser("admin");
      if (failure === "unsuccessful result") {
        mockSendEmail.mockResolvedValueOnce({ success: false });
      } else {
        mockSendEmail.mockRejectedValueOnce(
          new Error("Mail service unavailable"),
        );
      }

      const response = await testApi.emails.$post(
        { json: { ...validEmail, recipientIds: [user.id] } },
        { headers },
      );

      expect(response.status).toBe(500);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    },
  );
});
