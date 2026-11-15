// @vitest-environment node
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

type Registry = { __servicestartAuthHooks?: object };
const registry = globalThis as Registry;
// tests/unit/setup.ts registers the hooks in its beforeAll, which runs first.
let registered: object | undefined;
beforeAll(() => {
  registered = registry.__servicestartAuthHooks;
});

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  registry.__servicestartAuthHooks = registered;
  vi.resetModules();
});

describe("auth hook registry", () => {
  it("throws a clear error when a hook fires before registration", async () => {
    delete registry.__servicestartAuthHooks;
    const { getAuthHook } = await import("@/core/auth/authHooks");
    expect(() => getAuthHook("afterSessionCreated")).toThrow(
      /registerMembershipAuthHooks/,
    );
  });

  it("shares one registry across module copies", async () => {
    delete registry.__servicestartAuthHooks;
    const first = await import("@/core/auth/authHooks");
    vi.resetModules();
    const second = await import("@/core/auth/authHooks");
    const { registerMembershipAuthHooks } =
      await import("@/features/membership/authHooks");
    registerMembershipAuthHooks();
    registerMembershipAuthHooks();
    expect(first.getAuthHook("beforeRemoveMember")).toBeTypeOf("function");
    expect(second.getAuthHook("afterSessionCreated")).toBeTypeOf("function");
  });

  it("is registered for the test run", async () => {
    const { getAuthHook } = await import("@/core/auth/authHooks");
    expect(getAuthHook("afterSessionCreated")).toBeTypeOf("function");
    expect(getAuthHook("beforeRemoveMember")).toBeTypeOf("function");
  });
});
