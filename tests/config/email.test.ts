import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

let recordsDirectory: string;
beforeEach(() => {
  recordsDirectory = mkdtempSync(join(tmpdir(), "email-dns-"));
  vi.stubEnv("JUNO_API_KEY", "test-key");
  vi.stubEnv("SENDGRID_KEY", "SG.test-sendgrid-key");
  vi.stubEnv("EMAIL_SENDER_DOMAIN", "  Notifications.TEST  ");
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(recordsDirectory, { recursive: true, force: true });
});

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
      await expect(setupEmail({ recordsDirectory })).rejects.toThrow(
        `${name} is required`,
      );
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
    await setupEmail({ recordsDirectory });
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

it("persists the provider DNS response without credentials", async () => {
  const records = {
    mailCname: {
      valid: false,
      type: "cname",
      host: "mail.notifications.test",
      data: "provider.example.test",
    },
    dkim1: {
      valid: false,
      type: "cname",
      host: "s1._domainkey.notifications.test",
      data: "s1.provider.example.test",
    },
    dkim2: {
      valid: false,
      type: "cname",
      host: "s2._domainkey.notifications.test",
      data: "s2.provider.example.test",
    },
  };
  vi.mocked(juno.email.registerDomain).mockResolvedValue({
    id: 42,
    records,
  } as never);
  await setupEmail({ recordsDirectory });
  const saved = readFileSync(
    join(recordsDirectory, readdirSync(recordsDirectory)[0]),
    "utf8",
  );
  expect(JSON.parse(saved)).toMatchObject({
    domain: "notifications.test",
    subdomain: "mail",
    id: 42,
    records,
  });
  expect(saved).not.toContain("SG.test-sendgrid-key");
  expect(saved).not.toContain("test-key");
});

it("reports a DNS record write failure instead of reporting successful setup", async () => {
  vi.mocked(juno.email.registerDomain).mockResolvedValue({
    id: 42,
    records: {},
  } as never);
  await expect(
    setupEmail({
      recordsDirectory: join(
        import.meta.dirname,
        "email.test.ts",
        "not-a-directory",
      ),
    }),
  ).rejects.toThrow();
});

it("preserves earlier DNS snapshots when setup later returns simulated records", async () => {
  vi.mocked(juno.email.registerDomain).mockResolvedValueOnce({
    id: 42,
    records: {},
  } as never);
  await setupEmail({ recordsDirectory });
  vi.mocked(juno.email.registerDomain).mockResolvedValueOnce({
    id: 0,
    records: {},
  } as never);
  await setupEmail({ recordsDirectory });
  const snapshots = readdirSync(recordsDirectory).map((file) =>
    JSON.parse(readFileSync(join(recordsDirectory, file), "utf8")),
  );
  expect(snapshots).toHaveLength(2);
  expect(snapshots.map((snapshot) => snapshot.id).sort()).toEqual([0, 42]);
});
