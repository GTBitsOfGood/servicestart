// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import db from "@/lib/db";
import { members, users } from "@/lib/schema";
import { EmailService } from "@/lib/services/EmailService";
import { juno } from "@/lib/junoClient";
import { createOrganization } from "@/tests/unit/testUtils";

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

async function createUser(name: string, email: string) {
  const id = randomUUID();

  await db.insert(users).values({
    id,
    name,
    email,
  });

  return { id, name, email };
}

describe("EmailService", () => {
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

  it("emails only members of the target organization", async () => {
    const org = await createOrganization("alpha-team");
    const otherOrg = await createOrganization("other-team");

    const alice = await createUser("Alice", "ALICE@Example.com");
    const bob = await createUser("Bob", "bob@example.com");
    const carol = await createUser("Carol", "carol@example.com");

    await db.insert(members).values([
      {
        id: randomUUID(),
        userId: alice.id,
        organizationId: org.id,
        role: "member",
      },
      {
        id: randomUUID(),
        userId: alice.id,
        organizationId: org.id,
        role: "owner",
      },
      {
        id: randomUUID(),
        userId: bob.id,
        organizationId: org.id,
        role: "admin",
      },
      {
        id: randomUUID(),
        userId: carol.id,
        organizationId: otherOrg.id,
        role: "member",
      },
    ]);

    await EmailService.emailMembers(org.id, {
      subject: "Release Notes",
      content: [{ type: "text/plain", value: "hi" }],
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const payload = mockSendEmail.mock.calls[0]?.[0];
    expect(payload).toBeDefined();

    expect(payload?.sender).toEqual({
      email: "alpha-team@mail.notifications.test",
      name: "Organization alpha-team",
    });
    expect(payload?.subject).toBe("Release Notes");
    expect(payload?.contents).toEqual([{ type: "text/plain", value: "hi" }]);

    expect(payload?.recipients).toHaveLength(2);
    expect(payload?.recipients).toEqual(
      expect.arrayContaining([
        { email: "alice@example.com", name: "Alice" },
        { email: "bob@example.com", name: "Bob" },
      ]),
    );
    expect(payload?.recipients).not.toEqual(
      expect.arrayContaining([{ email: "carol@example.com", name: "Carol" }]),
    );
  });

  it("does not email the organization when the recipient list is empty", async () => {
    const org = await createOrganization("empty-targets");
    const alice = await createUser("Alice", "alice-empty@example.com");
    await db.insert(members).values({
      id: randomUUID(),
      userId: alice.id,
      organizationId: org.id,
      role: "member",
    });

    const sent = await EmailService.emailMembers(org.id, {
      subject: "Hello",
      content: [{ type: "text/plain", value: "No" }],
      targetUserIds: [],
    });

    expect(sent).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("does not email members from another organization", async () => {
    const org = await createOrganization("scoped-team");
    const otherOrg = await createOrganization("outside-team");
    const alice = await createUser("Alice", "alice-scoped@example.com");
    const carol = await createUser("Carol", "carol-scoped@example.com");

    await db.insert(members).values([
      {
        id: randomUUID(),
        userId: alice.id,
        organizationId: org.id,
        role: "member",
      },
      {
        id: randomUUID(),
        userId: carol.id,
        organizationId: otherOrg.id,
        role: "member",
      },
    ]);

    const sent = await EmailService.emailMembers(org.id, {
      subject: "Scoped",
      content: [{ type: "text/plain", value: "hi" }],
      targetUserIds: [alice.id, carol.id],
    });

    expect(sent).toBe(true);
    const payload = mockSendEmail.mock.calls[0]?.[0];
    expect(payload?.recipients).toEqual([
      { email: "alice-scoped@example.com", name: "Alice" },
    ]);
  });

  it("does not call Juno when organization has no members", async () => {
    const org = await createOrganization("no-members");

    await EmailService.emailMembers(org.id, {
      subject: "Hello",
      content: [{ type: "text/plain", value: "No" }],
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
