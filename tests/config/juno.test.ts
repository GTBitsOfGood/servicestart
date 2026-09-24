import { afterEach, expect, it, vi } from "vitest";

vi.mock("juno-sdk", () => ({
  default: { init: vi.fn(), email: { sendEmail: vi.fn() } },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("allows credential-free imports but rejects service access without an API key", async () => {
  vi.stubEnv("JUNO_API_KEY", " ");
  const { juno } = await import("../../lib/junoClient");
  expect(() => juno.email).toThrow("JUNO_API_KEY is required");
});

it("allows configured service access", async () => {
  vi.stubEnv("JUNO_API_KEY", "test-key");
  const { juno } = await import("../../lib/junoClient");
  expect(juno.email.sendEmail).toBeTypeOf("function");
});
