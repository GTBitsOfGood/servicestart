// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import db from "@/lib/db";
import { messageRecipients, messages } from "@/lib/schema";
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

async function setupOrgAndUser(role: "owner" | "admin" | "member") {
  const organization = await createOrganization(`msg-${Date.now()}`);
  const testUser = buildTestUser();
  const { user, session, headers } = await signUpAndGetSession(testUser);
  await setActiveOrganization(session.id, organization.id);
  await addMember(user.id, organization.id, role);
  return { organization, user, session, headers };
}

async function createMessage(
  organizationId: string,
  senderId: string,
  recipientUserIds: string[],
  opts: { subject?: string; sentAt?: Date } = {},
) {
  const id = randomUUID();
  await db.insert(messages).values({
    id,
    organizationId,
    senderId,
    subject: opts.subject ?? "Test subject",
    body: { content: [{ type: "text/plain", value: "hello" }] },
    sentAt: opts.sentAt ?? new Date(),
  });

  if (recipientUserIds.length > 0) {
    await db.insert(messageRecipients).values(
      recipientUserIds.map((userId) => ({
        messageId: id,
        userId,
      })),
    );
  }

  return id;
}

describe("GET /api/messages", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.messages.$get({ query: {} });

    expect(response.status).toBe(401);
  });

  it("returns only current user's messages for non-admins", async () => {
    const { organization, user, headers } = await setupOrgAndUser("member");
    const otherUser = buildTestUser();
    const { user: other } = await signUpAndGetSession(otherUser);
    await addMember(other.id, organization.id, "member");

    const ownMessageId = await createMessage(
      organization.id,
      user.id,
      [user.id],
      { subject: "Mine" },
    );
    await createMessage(organization.id, other.id, [other.id], {
      subject: "Other",
    });

    const response = await testApi.messages.$get({ query: {} }, { headers });
    const data = await response.json();

    expect(response.status).toBe(200);
    if (!("data" in data)) {
      throw new Error("Response is missing 'data' property");
    }
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(ownMessageId);
  });

  it("allows admins to fetch all messages", async () => {
    const { organization, user, headers } = await setupOrgAndUser("admin");
    const memberUser = buildTestUser();
    const { user: member } = await signUpAndGetSession(memberUser);
    await addMember(member.id, organization.id, "member");

    const firstId = await createMessage(organization.id, user.id, [user.id], {
      subject: "Admin",
      sentAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const secondId = await createMessage(
      organization.id,
      member.id,
      [member.id],
      { subject: "Member", sentAt: new Date("2026-01-02T00:00:00.000Z") },
    );

    const response = await testApi.messages.$get(
      { query: { scope: "all" } },
      { headers },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    if (!("data" in data)) {
      throw new Error("Response is missing 'data' property");
    }
    expect(data.data.map((item: { id: string }) => item.id)).toEqual([
      secondId,
      firstId,
    ]);
  });

  it("allows admins to fetch their own messages", async () => {
    const { organization, headers, user } = await setupOrgAndUser("admin");
    const memberUser = buildTestUser();
    const { user: member } = await signUpAndGetSession(memberUser);
    await addMember(member.id, organization.id, "member");

    const adminMessage = await createMessage(organization.id, user.id, [
      user.id,
    ]);
    await createMessage(organization.id, member.id, [member.id]);

    const response = await testApi.messages.$get(
      { query: { scope: "self" } },
      { headers },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    if (!("data" in data)) {
      throw new Error("Response is missing 'data' property");
    }
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(adminMessage);
  });

  it("allows admins to fetch a specific user's messages", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const memberUser = buildTestUser();
    const { user: member } = await signUpAndGetSession(memberUser);
    await addMember(member.id, organization.id, "member");

    const memberMessage = await createMessage(organization.id, member.id, [
      member.id,
    ]);

    const response = await testApi.messages.$get(
      { query: { scope: "user", userId: member.id } },
      { headers },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    if (!("data" in data)) {
      throw new Error("Response is missing 'data' property");
    }
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(memberMessage);
  });

  it("returns 404 when admin scopes to a non-member user", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const outsideUser = buildTestUser();
    const { user: outsider } = await signUpAndGetSession(outsideUser);

    const response = await testApi.messages.$get(
      { query: { scope: "user", userId: outsider.id } },
      { headers },
    );

    expect(response.status).toBe(404);
  });
});

describe("POST /api/messages", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.messages.$post({
      json: {
        subject: "Hello",
        textBody: "Hello",
      },
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admins", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.messages.$post(
      {
        json: {
          subject: "Hello",
          textBody: "Hello",
        },
      },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("creates a message and sends email for admins", async () => {
    const { organization, user, headers } = await setupOrgAndUser("admin");
    const memberUser = buildTestUser();
    const { user: member } = await signUpAndGetSession(memberUser);
    await addMember(member.id, organization.id, "member");

    const response = await testApi.messages.$post(
      {
        json: {
          subject: "Release",
          textBody: "It shipped",
        },
      },
      { headers },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    if (!("success" in payload)) {
      throw new Error("Response is missing 'success' property");
    }
    expect(payload.success).toBe(true);

    const storedMessage = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.organizationId, organization.id),
          eq(messages.senderId, user.id),
          eq(messages.subject, "Release"),
        ),
      );

    expect(storedMessage).toHaveLength(1);
    expect(mockEmailMembers).toHaveBeenCalledTimes(1);
    expect(mockEmailMembers).toHaveBeenCalledWith(organization.id, {
      subject: "Release",
      textBody: "It shipped",
      htmlBody: undefined,
    });
  });
});
