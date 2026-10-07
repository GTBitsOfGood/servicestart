// @vitest-environment node
import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "@/proxy";
import { createOrganization } from "@/tests/unit/testUtils";

it("admits existing tenant auth pages", async () => {
  await createOrganization("existing-tenant");
  const response = await proxy(
    new NextRequest("http://existing-tenant.lvh.me/login", {
      headers: { host: "existing-tenant.lvh.me" },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("x-middleware-rewrite")).toBeNull();
});

it("rewrites missing tenants with a non-indexable 404 and preserves the host", async () => {
  const response = await proxy(
    new NextRequest("https://missing.lvh.me/resetpassword?token=example", {
      headers: { host: "missing.lvh.me" },
    }),
  );
  expect(response.status).toBe(404);
  expect(response.headers.get("x-middleware-rewrite")).toBe(
    "https://missing.lvh.me/organization-not-found",
  );
  expect(response.headers.get("x-robots-tag")).toBe("noindex");
});

it.each([
  ["/login", true],
  ["/signup", true],
  ["/forgotpassword", true],
  ["/resetpassword?token=example", true],
  ["/", false],
  ["/events", false],
  ["/inbox", false],
  ["/api/notifications", false],
  ["/organization-not-found", false],
  ["/_next/static/app.js", false],
])("only checks auth routes: %s", (url, matches) => {
  expect(unstable_doesMiddlewareMatch({ config, url })).toBe(matches);
});
