// @vitest-environment node
import { describe, expect, it } from "vitest";
import { app } from "@/features/app";
import { OrganizationConfigKey } from "@/core/config/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

// The drafts sub-app (#338) has no routes yet, only the guard that every
// /api/forms/:formId/draft route goes through.
const draftUrl = "http://localhost/api/forms/camp-application-2027/draft";

async function memberOf(formsEnabled: boolean) {
  const org = await createOrganization(
    `drafts-${Math.random().toString(36).slice(2, 10)}`,
  );
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.FormsEnabled,
    String(formsEnabled),
  );
  const { user, session, headers } = await signUpAndGetSession(
    buildTestUser(),
    org.slug,
  );
  await addMember(user.id, org.id, "member");
  await setActiveOrganization(session.id, org.id);
  return headers;
}

describe("/api/forms/:formId/draft guard", () => {
  it("returns 401 when signed out", async () => {
    expect((await app.request(draftUrl)).status).toBe(401);
  });

  it.each(["GET", "PUT", "DELETE"])(
    "returns 404 for %s while forms are off",
    async (method) => {
      const headers = await memberOf(false);
      expect((await app.request(draftUrl, { method, headers })).status).toBe(
        404,
      );
    },
  );

  it("lets a member through while forms are on", async () => {
    const headers = await memberOf(true);
    // No draft route exists yet, so the request falls through to the admin
    // forms routes, which turn away a non-admin.
    expect((await app.request(draftUrl, { headers })).status).toBe(403);
  });
});
