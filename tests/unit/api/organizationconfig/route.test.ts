// @vitest-environment node
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import {
  organizationConfig,
  OrganizationConfigKey,
  organizations,
} from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

describe("GET /api/organizationConfig", () => {
  it("publicly returns the admin-configured logo and tagline for the requested tenant", async () => {
    const org = await createOrganization("cfg-branding");
    const otherOrg = await createOrganization("cfg-other-branding");
    await OrganizationConfigService.setConfig(
      otherOrg.id,
      OrganizationConfigKey.LogoUrl,
      "/sunset.svg",
    );
    const { user, session, headers } =
      await signUpAndGetSession(buildTestUser());
    await setActiveOrganization(session.id, org.id);
    await addMember(user.id, org.id, "admin");

    // The BetterAuth record deliberately disagrees with the branding config.
    await db
      .update(organizations)
      .set({ logo: "/wrong-logo.svg" })
      .where(eq(organizations.id, org.id));

    for (const [key, value] of [
      [OrganizationConfigKey.LogoUrl, "/bog.svg"],
      [OrganizationConfigKey.Tagline, "Configured organization tagline"],
    ] as const) {
      const saved = await testApi.organizationConfig.$put(
        { json: { key, value } },
        { headers },
      );
      expect(saved.status).toBe(200);
    }

    // No auth headers: this is how the signed-out pages retrieve branding.
    const response = await testApi.organizationConfig.$get({
      query: {
        keys: [OrganizationConfigKey.LogoUrl, OrganizationConfigKey.Tagline],
        organizationSlug: org.slug,
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      logo_url: "/bog.svg",
      tagline: "Configured organization tagline",
    });

    const hostResponse = await testApi.organizationConfig.$get(
      { query: { keys: [OrganizationConfigKey.LogoUrl] } },
      { headers: { host: `${org.slug}.servicestart.com` } },
    );
    expect(hostResponse.status).toBe(200);
    expect(await hostResponse.json()).toEqual({ logo_url: "/bog.svg" });

    const otherResponse = await testApi.organizationConfig.$get({
      query: {
        keys: [OrganizationConfigKey.LogoUrl, OrganizationConfigKey.Tagline],
        organizationSlug: otherOrg.slug,
      },
    });
    expect(otherResponse.status).toBe(200);
    expect(await otherResponse.json()).toEqual({
      logo_url: "/sunset.svg",
      tagline: "",
    });
  });

  it("returns null publicly when no logo is configured", async () => {
    const org = await createOrganization("cfg-no-logo");
    const response = await testApi.organizationConfig.$get({
      query: {
        keys: [OrganizationConfigKey.LogoUrl],
        organizationSlug: org.slug,
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ logo_url: null });
  });

  it("returns 200 and empty object when keys is []", async () => {
    const response = await testApi.organizationConfig.$get({
      query: {
        keys: [],
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({});
  });

  it("returns values for specified organizationSlug", async () => {
    const org = await createOrganization("cfg-get-slug");
    await db.insert(organizationConfig).values({
      id: randomUUID(),
      organizationId: org.id,
      key: OrganizationConfigKey.Description,
      value: "Org description",
    });

    const response = await testApi.organizationConfig.$get({
      query: {
        keys: ["description"],
        organizationSlug: "cfg-get-slug",
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ description: "Org description" });
  });

  it("falls back to active organization when organizationSlug is not provided", async () => {
    const org = await createOrganization("cfg-get-active");
    const user = buildTestUser();
    const { session, headers } = await signUpAndGetSession(user);
    await setActiveOrganization(session.id, org.id);
    // No membership required

    await db.insert(organizationConfig).values({
      id: randomUUID(),
      organizationId: org.id,
      key: OrganizationConfigKey.Description,
      value: "Active description",
    });

    const response = await testApi.organizationConfig.$get(
      {
        query: {
          keys: ["description"],
        },
      },
      {
        headers,
      },
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ description: "Active description" });
  });

  it("returns default value when key is not set", async () => {
    await createOrganization("cfg-get-default");
    const response = await testApi.organizationConfig.$get({
      query: {
        keys: ["description"],
        organizationSlug: "cfg-get-default",
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ description: "No description has been set" });
  });

  it("returns 400 for non-existent organizationSlug", async () => {
    const response = await testApi.organizationConfig.$get({
      query: {
        keys: ["description"],
        organizationSlug: "does-not-exist",
      },
    });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty(
      "error",
      "Requested organization does not exist",
    );
  });

  it("returns 400 when no organizationSlug and no active organization", async () => {
    const user = buildTestUser();
    const { headers } = await signUpAndGetSession(user);
    const response = await testApi.organizationConfig.$get(
      {
        query: {
          keys: ["description"],
        },
      },
      { headers },
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error", "No organizationId provided");
  });
});

describe("PUT /api/organizationConfig", () => {
  it("returns 401 when user is not authenticated", async () => {
    const response = await testApi.organizationConfig.$put({
      json: {
        key: OrganizationConfigKey.Description,
        value: "x",
      },
    });
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toHaveProperty("error", "Unauthorized");
  });

  it("returns 400 when user has no active organization", async () => {
    await createOrganization("cfg-put-no-active");
    const user = buildTestUser();
    const { headers } = await signUpAndGetSession(user);

    const response = await testApi.organizationConfig.$put(
      {
        json: {
          key: OrganizationConfigKey.Description,
          value: "x",
        },
      },
      { headers },
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error", "No active organization");
  });

  it("returns 403 when user is not admin or owner", async () => {
    const org = await createOrganization("cfg-put-no-admin");
    const user = buildTestUser();
    const { session, headers } = await signUpAndGetSession(user);
    await setActiveOrganization(session.id, org.id);
    // user is not a member or is member with insufficient role

    const response = await testApi.organizationConfig.$put(
      {
        json: {
          key: OrganizationConfigKey.Description,
          value: "x",
        },
      },
      { headers },
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toHaveProperty(
      "error",
      "Forbidden: Admin or owner role required",
    );
  });

  it("returns 400 for invalid key", async () => {
    const org = await createOrganization("cfg-put-invalid-key");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);
    await setActiveOrganization(session.id, org.id);
    await addMember(admin.id, org.id, "admin");

    const response = await testApi.organizationConfig.$put(
      {
        json: { key: "not-a-key", value: "x" } as unknown as {
          key: OrganizationConfigKey;
          value: string;
        },
      },
      { headers },
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error", "Invalid key");
  });

  it("returns 400 for invalid value (HTML tags)", async () => {
    const org = await createOrganization("cfg-put-invalid-value");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);
    await setActiveOrganization(session.id, org.id);
    await addMember(admin.id, org.id, "admin");

    const response = await testApi.organizationConfig.$put(
      {
        json: {
          key: OrganizationConfigKey.Description,
          value: "<b>bad</b>",
        },
      },
      { headers },
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty(
      "error",
      "Description must not contain HTML tags",
    );
  });

  it("updates config when admin or owner", async () => {
    const org = await createOrganization("cfg-put-success");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);
    await setActiveOrganization(session.id, org.id);
    await addMember(admin.id, org.id, "admin");

    const response = await testApi.organizationConfig.$put(
      {
        json: {
          key: OrganizationConfigKey.Description,
          value: "Updated description",
        },
      },
      { headers },
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("ok", true);

    const rows = await db
      .select()
      .from(organizationConfig)
      .where(eq(organizationConfig.organizationId, org.id));
    expect(rows.length).toBe(1);
    expect(rows[0].value).toBe("Updated description");
  });

  it("stores admin dashboard layout via PUT", async () => {
    const org = await createOrganization("cfg-put-adl");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);
    await setActiveOrganization(session.id, org.id);
    await addMember(admin.id, org.id, "admin");

    const layout = {
      layout: "horizontal",
      widgets: [
        { id: "events", size: "tall" },
        { id: "notifications", size: "small" },
        { id: "member_requests", size: "small" },
      ],
    };

    const response = await testApi.organizationConfig.$put(
      {
        json: {
          key: OrganizationConfigKey.AdminDashboardLayout,
          value: JSON.stringify(layout),
        },
      },
      { headers },
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("ok", true);

    const rows = await db
      .select()
      .from(organizationConfig)
      .where(eq(organizationConfig.organizationId, org.id));
    const adlRow = rows.find(
      (r) => r.key === OrganizationConfigKey.AdminDashboardLayout,
    );
    expect(adlRow).toBeDefined();
    expect(JSON.parse(adlRow!.value)).toEqual(layout);
  });

  it("stores member dashboard layout via PUT", async () => {
    const org = await createOrganization("cfg-put-dl");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);
    await setActiveOrganization(session.id, org.id);
    await addMember(admin.id, org.id, "admin");

    const layout = {
      layout: "horizontal",
      widgets: [
        { id: "events", size: "tall" },
        { id: "newsletter", size: "tall" },
      ],
    };

    const response = await testApi.organizationConfig.$put(
      {
        json: {
          key: OrganizationConfigKey.DashboardLayout,
          value: JSON.stringify(layout),
        },
      },
      { headers },
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("ok", true);
  });

  it("rejects invalid dashboard layout via PUT", async () => {
    const org = await createOrganization("cfg-put-dl-invalid");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);
    await setActiveOrganization(session.id, org.id);
    await addMember(admin.id, org.id, "admin");

    const response = await testApi.organizationConfig.$put(
      {
        json: {
          key: OrganizationConfigKey.AdminDashboardLayout,
          value: "not-valid-json",
        },
      },
      { headers },
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  it("retrieves dashboard layout via GET", async () => {
    const org = await createOrganization("cfg-get-dl");
    const layout = {
      layout: "horizontal",
      widgets: [{ id: "events", size: "tall" }],
    };

    await db.insert(organizationConfig).values({
      id: randomUUID(),
      organizationId: org.id,
      key: OrganizationConfigKey.DashboardLayout,
      value: JSON.stringify(layout),
    });

    const response = await testApi.organizationConfig.$get({
      query: {
        keys: [OrganizationConfigKey.DashboardLayout],
        organizationSlug: "cfg-get-dl",
      },
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data[OrganizationConfigKey.DashboardLayout]).toEqual(layout);
  });
});
