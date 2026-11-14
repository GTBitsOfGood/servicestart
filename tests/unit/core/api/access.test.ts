// @vitest-environment node
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { app } from "@/features/app";
import { handleError } from "@/core/api/handleError";
import serveImage from "@/core/files/api/serveImage";
import forms from "@/features/forms/api/forms";
import formQuestions from "@/features/forms/api/formQuestions";
import formSubmissions from "@/features/forms/api/formSubmissions";
import drafts from "@/features/forms/api/drafts";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  OrganizationConfigKey,
  FormStatus,
  EventVisibility,
} from "@/core/db/schema";
import {
  addMember,
  buildHost,
  buildTestUser,
  createOrganization,
  createForm,
  createMedia,
  createEvent,
  createJoinRequest,
  setActiveOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

async function caller(role = "admin", enabled = true) {
  const org = await createOrganization(`access-${randomUUID()}`);
  const { user, session, headers } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, org.id, role);
  await setActiveOrganization(session.id, org.id);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.FormsEnabled,
    String(enabled),
  );
  return { org, user, session, headers };
}

const missingId = "00000000-0000-4000-8000-000000000001";
const reads = [
  "/api/events",
  "/api/announcements",
  "/api/joinRequests",
  "/api/media",
  "/api/notifications",
  "/api/tags",
  `/api/shifts/${missingId}`,
];

describe("central API access", () => {
  it.each(reads)("%s returns a JSON 401 without a session", async (path) => {
    const response = await app.request(path);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects host/session mismatch across route groups, even for an admin of both orgs", async () => {
    const { org: b, user, headers } = await caller();
    const a = await createOrganization("access-other-host");
    await addMember(user.id, a.id, "admin");
    for (const path of [...reads, "/api/forms"]) {
      const response = await app.request(path, {
        headers: { ...headers, host: buildHost(a.slug) },
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Forbidden" });
    }
    expect(
      (
        await app.request("/api/tags", {
          headers: { ...headers, host: buildHost(b.slug) },
        })
      ).status,
    ).toBe(200);
    const response = await app.request("/api/profile/picture", {
      method: "POST",
      headers: { ...headers, host: buildHost(a.slug) },
    });
    expect(response.status).toBe(403);
  });

  it("preserves 403s for members on admin routes and 404s for missing records", async () => {
    const { headers } = await caller("member");
    for (const path of ["/api/media", "/api/joinRequests", "/api/forms"]) {
      expect((await app.request(path, { headers })).status).toBe(403);
    }
    for (const path of [
      `/api/events/${missingId}`,
      `/api/notifications/${missingId}`,
      `/api/media/${missingId}`,
      `/api/shifts/${missingId}`,
    ]) {
      expect((await app.request(path, { headers })).status).toBe(404);
    }
    expect(
      (
        await app.request(`/api/tags/${missingId}`, {
          method: "DELETE",
          headers,
        })
      ).status,
    ).toBe(403);
    const admin = await caller();
    expect(
      (
        await app.request(`/api/tags/${missingId}`, {
          method: "DELETE",
          headers: admin.headers,
        })
      ).status,
    ).toBe(404);
    expect(
      (await app.request("/api/profile/picture", { method: "POST" })).status,
    ).toBe(401);
  });

  it("returns 404 across every forms endpoint family while forms are off", async () => {
    const { headers } = await caller("admin", false);
    const cases = [
      ["GET", "/api/forms"],
      ["GET", "/api/forms/application/questions"],
      ["GET", "/api/forms/application/draft"],
      ["GET", "/api/formResponses/application"],
      ["POST", "/api/informationRequests"],
      ["POST", "/api/forms/application/submissions"],
      ["PUT", "/api/forms/application/submissions/mine"],
      ["POST", "/api/forms/application/uploads"],
      ["GET", `/api/forms/application/my-uploads/${missingId}`],
    ];
    for (const [method, path] of cases) {
      expect((await app.request(path, { method, headers })).status).toBe(404);
    }
  });

  it.each([false, true])(
    "member forms access is independent of reverse mount order: %s",
    async (reverse) => {
      const { org, user, headers } = await caller("member");
      await createForm(org.id, {
        formId: "application",
        status: FormStatus.Published,
        settings: { requireLogin: true },
        components: [],
      });
      const memberApps = new Hono()
        .route("/", formQuestions)
        .route("/", formSubmissions)
        .route("/", drafts)
        // #338 will supply the draft handlers. This verifies that its member guard
        // reaches a handler without an unrelated forms admin guard intercepting.
        .get("/application/draft", (c) => c.json({ userId: user.id }));
      const root = new Hono().onError(handleError);
      const router = reverse
        ? root.route("/api/forms", forms).route("/api/forms", memberApps)
        : root.route("/api/forms", memberApps).route("/api/forms", forms);
      expect(
        (await router.request("/api/forms/application/draft", { headers }))
          .status,
      ).toBe(200);
      expect(
        (await router.request("/api/forms/application/questions", { headers }))
          .status,
      ).toBe(403);
      const response = await router.request(
        "/api/forms/application/submissions",
        {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ answers: {} }),
        },
      );
      expect(response.status).toBe(201);
      expect(
        (
          await router.request(
            `/api/forms/application/my-uploads/${missingId}`,
            { headers },
          )
        ).status,
      ).toBe(404);
      expect((await router.request("/api/forms", { headers })).status).toBe(
        403,
      );
    },
  );

  it("does not fall back to global public event data for an unselected session on a tenant host", async () => {
    const org = await createOrganization("unselected-tenant");
    const { headers } = await signUpAndGetSession(buildTestUser(), org.slug);
    const response = await app.request("/api/events", {
      headers: { ...headers, host: buildHost(org.slug) },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "No active organization" });
  });

  it("conceals a join request behind an unknown tenant host even without an active org", async () => {
    const org = await createOrganization("request-host");
    const { user, headers } = await signUpAndGetSession(
      buildTestUser(),
      org.slug,
    );
    await createJoinRequest(user.id, org.id);
    expect(
      (await app.request(`/api/joinRequests/${org.id}`, { headers })).status,
    ).toBe(200);
    const response = await app.request(`/api/joinRequests/${org.id}`, {
      headers: { ...headers, host: buildHost("unknown") },
    });
    expect(response.status).toBe(404);
  });

  it("does not expose another organization's public event on a tenant host", async () => {
    const { org, headers } = await caller();
    const other = await createOrganization("public-event-other");
    const eventId = await createEvent(other.id, {
      publishedAt: new Date(),
      visibility: EventVisibility.Public,
    });
    const response = await app.request(`/api/events/${eventId}`, {
      headers: { ...headers, host: buildHost(org.slug) },
    });
    expect(response.status).toBe(404);
  });

  it("applies shared JSON errors and tenant scoping to image serving", async () => {
    const { org, user, headers } = await caller();
    const other = await createOrganization("image-other");
    await addMember(user.id, other.id, "admin");
    const mediaId = await createMedia(other.id);
    const anonymous = await serveImage.request(`/images/${mediaId}`);
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({ error: "Unauthorized" });
    const missing = await serveImage.request(`/images/${mediaId}`, {
      headers: { ...headers, host: buildHost(org.slug) },
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Image not found" });
    const mismatch = await serveImage.request(`/images/${mediaId}`, {
      headers: { ...headers, host: buildHost(other.slug) },
    });
    expect(mismatch.status).toBe(403);
  });
});
