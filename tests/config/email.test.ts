import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { validateSendGridKey } from "juno-sdk/lib/validators";
import { getDbUrl, getEmailSenderDomain, requireEnv } from "../../lib/env";
import { setupEmail } from "../../lib/emailSetup";
import { EmailService } from "../../lib/services/EmailService";
import { juno } from "../../lib/junoClient";

vi.mock("../../lib/junoClient", () => ({
  juno: {
    email: {
      setupEmail: vi.fn(),
      registerDomain: vi.fn(),
      sendEmail: vi.fn(),
      registerSenderAddress: vi.fn(),
    },
  },
}));
vi.mock("@/lib/services/OrganizationService", () => ({
  OrganizationsService: {},
}));
vi.mock("@/lib/services/MemberService", () => ({ MembersService: {} }));
vi.mock("@/lib/authClient", () => ({ default: {} }));

beforeEach(() => {
  vi.stubEnv("JUNO_API_KEY", "test-key");
  vi.stubEnv("SENDGRID_KEY", "SG.test-sendgrid-key");
  vi.stubEnv("EMAIL_SENDER_DOMAIN", "  Notifications.TEST  ");
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

describe("configuration errors", () => {
  it.each([undefined, "", "   "])(
    "rejects missing or blank required values (%s)",
    (value) => {
      vi.stubEnv("DB_URL", value);
      vi.stubEnv("BETTER_AUTH_SECRET", value);
      expect(() => requireEnv("DB_URL")).toThrow(/DB_URL is required.*\.env/);
      expect(() => requireEnv("BETTER_AUTH_SECRET")).toThrow(
        /BETTER_AUTH_SECRET is required/,
      );
    },
  );
  it("normalizes the email domain", () => {
    expect(getEmailSenderDomain()).toBe("notifications.test");
  });
  it("keeps preview database resolution and rejects blank database URLs", () => {
    vi.stubEnv("DB_URL", "postgres://test:root@localhost:5433/<branch>");
    expect(getDbUrl("pull/257/head")).toBe(
      "postgres://test:root@localhost:5433/pr257",
    );
    vi.stubEnv("DB_URL", " ");
    expect(() => getDbUrl()).toThrow("DB_URL is required");
  });
  it.each(["SENDGRID_KEY", "EMAIL_SENDER_DOMAIN", "JUNO_API_KEY"])(
    "fails setup before external calls when %s is missing",
    async (name) => {
      vi.stubEnv(name, " ");
      await expect(setupEmail()).rejects.toThrow(`${name} is required`);
      expect(juno.email.setupEmail).not.toHaveBeenCalled();
      expect(juno.email.registerDomain).not.toHaveBeenCalled();
    },
  );
});

it("provisions email using the normalized domain without file credentials", async () => {
  vi.stubEnv("JUNO_PROJECT_ID", "");
  vi.stubEnv("AZURE_STORAGE_ACCOUNT_KEY", "");
  vi.mocked(juno.email.registerDomain).mockResolvedValue({
    id: 0,
    records: {},
  } as never);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await setupEmail();
    expect(juno.email.setupEmail).toHaveBeenCalledWith({
      sendgridKey: "SG.test-sendgrid-key",
    });
    expect(juno.email.registerDomain).toHaveBeenCalledWith({
      domain: "notifications.test",
      subdomain: "mail",
    });
  } finally {
    log.mockRestore();
  }
});

it("ships simulated SendGrid keys accepted by the actual Juno SDK", () => {
  for (const file of [".env.template", ".env.test"]) {
    const env = parse(readFileSync(new URL(`../../${file}`, import.meta.url)));
    expect(() => validateSendGridKey(env.SENDGRID_KEY)).not.toThrow();
  }
  expect(() => validateSendGridKey("test-key")).toThrow();
});

const invitation = {
  id: "invite-1",
  email: "recipient@example.test",
  organization: { id: "org-1", name: "Test", slug: "test" },
  inviter: { user: { name: "Owner", email: "owner@example.test" } },
  invitation: {
    expiresAt: new Date("2030-01-01"),
    role: "member",
    name: "Recipient",
  },
};

it("rejects a missing sender domain without sending or deriving a localhost sender", async () => {
  vi.stubEnv("EMAIL_SENDER_DOMAIN", "");
  await expect(EmailService.sendInvitationEmail(invitation)).rejects.toThrow(
    "EMAIL_SENDER_DOMAIN is required",
  );
  expect(juno.email.sendEmail).not.toHaveBeenCalled();
});

it("uses the default application URL and normalized domain for invitations", async () => {
  await EmailService.sendInvitationEmail(invitation);
  const payload = vi.mocked(juno.email.sendEmail).mock.calls[0][0];
  expect(payload.sender.email).toBe("test@mail.notifications.test");
  expect(payload.contents[0].value).toContain(
    "http://localhost:3000/accept-invitation/invite-1",
  );
});
