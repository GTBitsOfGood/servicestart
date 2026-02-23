import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import db from "@/lib/db";
import { members, users } from "@/lib/schema";
import { EmailService } from "@/lib/services/EmailService";
import { juno } from "@/lib/services/junoClient";
import { createOrganization } from "@/tests/unit/testUtils";

vi.mock("@/lib/services/junoClient", () => ({
  juno: {
    email: {
      sendEmail: vi.fn(async () => ({ statusCode: 202 })),
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
    mockSendEmail.mockResolvedValue({ statusCode: 202 } as never);
  });

  afterAll(() => {
    process.env.EMAIL_SENDER_DOMAIN = previousSenderDomain;
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
      textBody: "v1.0 shipped",
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const payload = mockSendEmail.mock.calls[0]?.[0];
    expect(payload).toBeDefined();

    expect(payload?.sender).toEqual({
      email: "alpha-team@mail.notifications.test",
      name: "Organization alpha-team",
    });
    expect(payload?.subject).toBe("Release Notes");
    expect(payload?.contents).toEqual([
      { type: "text/plain", value: "v1.0 shipped" },
    ]);

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

  it("does not call Juno when organization has no members", async () => {
    const org = await createOrganization("no-members");

    await EmailService.emailMembers(org.id, {
      subject: "Hello",
      textBody: "No recipients",
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
