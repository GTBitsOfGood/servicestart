import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { organizationConfig, OrganizationConfigKey } from "@/lib/schema";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

describe("GET /api/organizationconfig", () => {
  it("returns 200 and empty object when keys is missing", async () => {
    const response = await testApi.organizationconfig.$get({
      query: {},
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

    const response = await testApi.organizationconfig.$get({
      query: {
        keys: "description",
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

    const response = await testApi.organizationconfig.$get(
      {
        query: {
          keys: "description",
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
    const response = await testApi.organizationconfig.$get({
      query: {
        keys: "description",
        organizationSlug: "cfg-get-default",
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ description: "No description has been set" });
  });

  it("returns 400 for non-existent organizationSlug", async () => {
    const response = await testApi.organizationconfig.$get({
      query: {
        keys: "description",
        organizationSlug: "does-not-exist",
      },
    });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Requested organization does not exist");
  });

  it("returns 400 when no organizationSlug and no active organization", async () => {
    const user = buildTestUser();
    const { headers } = await signUpAndGetSession(user);
    const response = await testApi.organizationconfig.$get(
      {
        query: {
          keys: "description",
        },
      },
      { headers },
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("No organizationId provided");
  });
});

describe("PUT /api/organizationconfig", () => {
  it("returns 401 when user is not authenticated", async () => {
    const response = await testApi.organizationconfig.$put({
      json: {
        key: OrganizationConfigKey.Description,
        value: "x",
      },
    });
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when user has no active organization", async () => {
    await createOrganization("cfg-put-no-active");
    const user = buildTestUser();
    const { headers } = await signUpAndGetSession(user);

    const response = await testApi.organizationconfig.$put(
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
    expect(data.error).toBe("No active organization");
  });

  it("returns 403 when user is not admin or owner", async () => {
    const org = await createOrganization("cfg-put-no-admin");
    const user = buildTestUser();
    const { session, headers } = await signUpAndGetSession(user);
    await setActiveOrganization(session.id, org.id);
    // user is not a member or is member with insufficient role

    const response = await testApi.organizationconfig.$put(
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
    expect(data.error).toBe("Forbidden: Admin or owner role required");
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

    const response = await testApi.organizationconfig.$put(
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
    expect(data.error).toBe("Invalid key");
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

    const response = await testApi.organizationconfig.$put(
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
    expect(data.error).toBe("Description must not contain HTML tags");
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

    const response = await testApi.organizationconfig.$put(
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
    expect(data.ok).toBe(true);

    const rows = await db
      .select()
      .from(organizationConfig)
      .where(eq(organizationConfig.organizationId, org.id));
    expect(rows.length).toBe(1);
    expect(rows[0].value).toBe("Updated description");
  });
});
