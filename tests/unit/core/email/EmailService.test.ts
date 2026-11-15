// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EmailService,
  organizationSenderEmail,
} from "@/core/email/EmailService";
import { juno } from "@/core/files/junoClient";
import { createOrganization } from "@/tests/unit/testUtils";

vi.mock("@/core/files/junoClient", () => ({
  juno: {
    email: {
      sendEmail: vi.fn(async () => ({ success: true })),
      registerSenderAddress: vi.fn(async () => ({ statusCode: 201 })),
    },
  },
}));

const mockSendEmail = vi.mocked(juno.email.sendEmail);
const previousSenderDomain = process.env.EMAIL_SENDER_DOMAIN;

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

  it("emails invitation links on the invited tenant rather than the default host", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3000");
    try {
      const org = await createOrganization("invite-link");
      await EmailService.sendInvitationEmail({
        id: "invitation-id",
        email: "invitee@example.com",
        organization: { ...org, name: "Invited organization" },
        inviter: { user: { name: "Admin", email: "admin@example.com" } },
        invitation: {
          expiresAt: new Date("2027-01-01"),
          role: "member",
          name: "Invitee",
        },
      });
      expect(mockSendEmail.mock.calls[0][0].contents[0].value).toContain(
        "http://invite-link.lvh.me:3000/accept-invitation/invitation-id",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([
    ["alpha-team", "alpha-team@mail.notifications.test"],
    ["  Alpha Team  ", "alpha-team@mail.notifications.test"],
    ["--a__b--", "a-b@mail.notifications.test"],
    ["Café", "caf@mail.notifications.test"],
  ])("derives the sender address for slug %j", (slug, expected) => {
    expect(organizationSenderEmail(slug)).toBe(expected);
  });

  it("has no sender address for a slug without letters or digits", () => {
    expect(organizationSenderEmail("--")).toBeNull();
  });
});
