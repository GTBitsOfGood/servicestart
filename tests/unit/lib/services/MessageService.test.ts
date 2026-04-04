import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { members, messages, users } from "@/lib/schema";
import { EmailService } from "@/lib/services/EmailService";
import { MessageService } from "@/lib/services/MessageService";
import { MembersService } from "@/lib/services/MemberService";
import { createOrganization } from "@/tests/unit/testUtils";

vi.mock("@/lib/services/EmailService", () => ({
  EmailService: {
    emailMembers: vi.fn(async () => {}),
    registerOrganizationSender: vi.fn(async () => {}),
  },
}));

vi.mock("@/lib/services/MemberService", () => ({
  MembersService: {
    getUserIdsByOrganization: vi.fn(async () => []),
    findByUserAndOrganization: vi.fn(async () => null),
    isAdminOrOwner: vi.fn(() => false),
    listMemberContacts: vi.fn(async () => []),
    listMembers: vi.fn(async () => []),
    countByOrganization: vi.fn(async () => 0),
    getMemberActivity: vi.fn(async () => ({})),
  },
}));

const mockEmailMembers = vi.mocked(EmailService.emailMembers);
const mockGetUserIds = vi.mocked(MembersService.getUserIdsByOrganization);

async function createUser(name: string, email: string) {
  const id = randomUUID();
  await db.insert(users).values({ id, name, email });
  return { id, name, email };
}

async function addMember(userId: string, organizationId: string) {
  await db.insert(members).values({
    id: randomUUID(),
    userId,
    organizationId,
    role: "member",
  });
}

beforeEach(() => {
  mockEmailMembers.mockReset();
  mockEmailMembers.mockResolvedValue(undefined);
  mockGetUserIds.mockReset();
  mockGetUserIds.mockResolvedValue([]);
});

describe("MessageService", () => {
  it("creates a message and emails when members exist", async () => {
    const org = await createOrganization("alpha-team");
    const sender = await createUser("Sender", "sender@example.com");
    const alice = await createUser("Alice", "alice@example.com");
    const bob = await createUser("Bob", "bob@example.com");

    await addMember(alice.id, org.id);
    await addMember(bob.id, org.id);
    mockGetUserIds.mockResolvedValue([alice.id, bob.id]);

    const message = await MessageService.createAndSend({
      id: randomUUID(),
      organizationId: org.id,
      senderId: sender.id,
      subject: "Hello",
      textBody: "Hello members",
    });

    expect(message).not.toBeNull();
    expect(message?.id).toBeDefined();

    const storedMessage = await db
      .select({
        id: messages.id,
        subject: messages.subject,
        organizationId: messages.organizationId,
        senderId: messages.senderId,
        body: messages.body,
      })
      .from(messages)
      .where(eq(messages.id, message!.id));

    expect(storedMessage).toHaveLength(1);
    expect(storedMessage[0]).toEqual({
      id: message?.id,
      subject: "Hello",
      organizationId: org.id,
      senderId: sender.id,
      body: { content: [{ type: "text/plain", value: "Hello members" }] },
    });
    expect(mockGetUserIds).toHaveBeenCalledWith(org.id);

    expect(mockEmailMembers).toHaveBeenCalledTimes(1);
    expect(mockEmailMembers).toHaveBeenCalledWith(org.id, {
      subject: "Hello",
      content: [{ type: "text/plain", value: "Hello members" }],
    });
  });

  it("creates a message but does not email when no members exist", async () => {
    const org = await createOrganization("bravo-team");
    const sender = await createUser("Sender", "sender2@example.com");
    mockGetUserIds.mockResolvedValue([]);

    const message = await MessageService.createAndSend({
      id: randomUUID(),
      organizationId: org.id,
      senderId: sender.id,
      subject: "Private",
      textBody: "Hello Alice",
    });

    expect(message).not.toBeNull();
    expect(message?.id).toBeDefined();
    expect(mockGetUserIds).toHaveBeenCalledWith(org.id);

    expect(mockEmailMembers).not.toHaveBeenCalled();
  });
});
