// @vitest-environment node
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  resolveOrganization,
  assertOrganizationMatchesHost,
} from "@/core/tenant/resolveOrganization";
import { ForbiddenError } from "@/core/api/errors";
import { createOrganization, buildHost } from "@/tests/unit/testUtils";

describe("resolveOrganization", () => {
  it("uses the tenant host ahead of the active session organization", async () => {
    const a = await createOrganization("resolve-a");
    const b = await createOrganization("resolve-b");
    const headers = new Headers({ host: buildHost(a.slug) });
    const session = { session: { activeOrganizationId: b.id } };
    expect((await resolveOrganization(headers, session))?.id).toBe(a.id);
    await expect(
      assertOrganizationMatchesHost(headers, session),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      assertOrganizationMatchesHost(headers, {
        session: { activeOrganizationId: a.id },
      }),
    ).resolves.toBeUndefined();
  });

  it("resolves a host without a session and a session on default hosts", async () => {
    const org = await createOrganization("resolve-host");
    expect(
      (await resolveOrganization(new Headers({ host: buildHost(org.slug) })))
        ?.id,
    ).toBe(org.id);
    for (const host of [
      "localhost:3000",
      "lvh.me",
      "deploy-preview-335--servicestart.netlify.app",
    ]) {
      expect(
        (
          await resolveOrganization(new Headers({ host }), {
            session: { activeOrganizationId: org.id },
          })
        )?.id,
      ).toBe(org.id);
      expect(await resolveOrganization(new Headers({ host }))).toBeNull();
    }
  });

  it("returns null for missing and unknown organizations without host fallback", async () => {
    const org = await createOrganization("resolve-fallback");
    expect(await resolveOrganization(new Headers())).toBeNull();
    expect(
      await resolveOrganization(new Headers(), {
        session: { activeOrganizationId: "missing" },
      }),
    ).toBeNull();
    expect(
      await resolveOrganization(new Headers({ host: buildHost("missing") }), {
        session: { activeOrganizationId: org.id },
      }),
    ).toBeNull();
  });

  it("accepts a Hono context", async () => {
    const org = await createOrganization("resolve-hono");
    const app = new Hono().get("/", async (c) =>
      c.json(await resolveOrganization(c)),
    );
    const response = await app.request("http://localhost/", {
      headers: { host: buildHost(org.slug) },
    });
    expect((await response.json()).id).toBe(org.id);
  });
});
