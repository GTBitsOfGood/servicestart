import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { validateSendGridKey } from "juno-sdk/lib/validators";
import { getDbUrl, getEmailSenderDomain, requireEnv } from "@/core/utils/env";
import { ResponseError } from "juno-sdk/internal/runtime";
import {
  setupEmail,
  setupEmailUnlessAllowedToFail,
} from "@/core/email/emailSetup";
import { EmailService } from "@/core/email/EmailService";
import { juno } from "@/core/files/junoClient";

vi.mock("@/core/files/junoClient", () => ({
  juno: {
    email: {
      setupEmail: vi.fn(),
      registerDomain: vi.fn(),
      sendEmail: vi.fn(),
      registerSenderAddress: vi.fn(),
    },
  },
}));
vi.mock("@/core/tenant/OrganizationService", () => ({
  OrganizationsService: {},
}));
vi.mock("@/features/membership/services/MemberService", () => ({
  MembersService: {},
}));
vi.mock("@/core/auth/authClient", () => ({ default: {} }));

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

describe(setupEmailUnlessAllowedToFail, () => {
  // What Juno sends back when SendGrid rejects a domain: the serialized axios
  // error, request config and Authorization header included.
  const sendGridRejection = (body: string) =>
    new ResponseError(
      new Response(body, { status: 400 }),
      "Response returned an error code",
    );
  const SERIALIZED_AXIOS_ERROR = JSON.stringify({
    message: "Request failed with status code 401",
    name: "AxiosError",
    code: "ERR_BAD_REQUEST",
    status: 401,
    config: { headers: { Authorization: "Bearer SG.leaked-sendgrid-key" } },
  });

  async function run() {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await setupEmailUnlessAllowedToFail();
      return warn.mock.calls.map((args) => args.join(" ")).join("\n");
    } finally {
      warn.mockRestore();
    }
  }

  it("still fails when Juno rejects the domain and the flag isn't set", async () => {
    vi.mocked(juno.email.registerDomain).mockRejectedValue(
      sendGridRejection(SERIALIZED_AXIOS_ERROR),
    );
    await expect(run()).rejects.toBeInstanceOf(ResponseError);
  });

  it("warns with the statuses, never the body, when the flag is set", async () => {
    vi.stubEnv("ALLOW_EMAIL_SETUP_FAILURE", "true");
    vi.mocked(juno.email.registerDomain).mockRejectedValue(
      sendGridRejection(SERIALIZED_AXIOS_ERROR),
    );
    const warning = await run();
    expect(warning).toContain("::warning title=Email setup failed (#342)::");
    expect(warning).toContain(
      "Juno responded 400; SendGrid responded 401 (ERR_BAD_REQUEST).",
    );
    expect(warning).not.toContain("SG.leaked-sendgrid-key");
    expect(warning).not.toContain("Bearer");
  });

  it("reports only Juno's status when its body isn't a serialized error", async () => {
    vi.stubEnv("ALLOW_EMAIL_SETUP_FAILURE", "true");
    vi.mocked(juno.email.registerDomain).mockRejectedValue(
      sendGridRejection("<html>Bad Request SG.leaked-sendgrid-key</html>"),
    );
    const warning = await run();
    expect(warning).toContain("Juno responded 400. Continuing");
    expect(warning).not.toContain("SG.leaked-sendgrid-key");
  });

  it("still fails on missing configuration when the flag is set", async () => {
    vi.stubEnv("ALLOW_EMAIL_SETUP_FAILURE", "true");
    vi.stubEnv("SENDGRID_KEY", " ");
    await expect(run()).rejects.toThrow("SENDGRID_KEY is required");
    expect(juno.email.registerDomain).not.toHaveBeenCalled();
  });
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

it("uses the tenant application URL and normalized sender domain for invitations", async () => {
  await EmailService.sendInvitationEmail(invitation);
  const payload = vi.mocked(juno.email.sendEmail).mock.calls[0][0];
  expect(payload.sender.email).toBe("test@mail.notifications.test");
  expect(payload.contents[0].value).toContain(
    "http://test.lvh.me:3000/accept-invitation/invite-1",
  );
});
