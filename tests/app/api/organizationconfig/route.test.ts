import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { GET, PUT } from "@/app/api/organizationconfig/route";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { organizationConfig, OrganizationConfigKey } from "@/lib/schema";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "../../../testUtils";

describe("GET /api/organizationconfig", () => {
  it("returns 200 and empty object when keys is missing", async () => {
    const request = new Request("http://localhost/api/organizationconfig");
    const response = await GET(request);
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

    const request = new Request(
      "http://localhost/api/organizationconfig?keys=description&organizationSlug=cfg-get-slug",
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ description: "Org description" });
  });

  it("falls back to active organization when organizationSlug is not provided", async () => {
    const org = await createOrganization("cfg-get-active");
    const user = buildTestUser();
    const { user: u, session, headers } = await signUpAndGetSession(user);
    await setActiveOrganization(session.id, org.id);
    // No membership required

    await db.insert(organizationConfig).values({
      id: randomUUID(),
      organizationId: org.id,
      key: OrganizationConfigKey.Description,
      value: "Active description",
    });

    const request = new Request(
      "http://localhost/api/organizationconfig?keys=description",
      { headers },
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ description: "Active description" });
  });

  it("returns default value when key is not set", async () => {
    const org = await createOrganization("cfg-get-default");
    const request = new Request(
      "http://localhost/api/organizationconfig?keys=description&organizationSlug=cfg-get-default",
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ description: "No description has been set" });
  });

  it("returns 400 for non-existent organizationSlug", async () => {
    const request = new Request(
      "http://localhost/api/organizationconfig?keys=description&organizationSlug=does-not-exist",
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Requested organization does not exist");
  });

  it("returns 400 when no organizationSlug and no active organization", async () => {
    const user = buildTestUser();
    const { headers } = await signUpAndGetSession(user);
    const request = new Request(
      "http://localhost/api/organizationconfig?keys=description",
      { headers },
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("No organizationId provided");
  });
});

describe("PUT /api/organizationconfig", () => {
  it("returns 401 when user is not authenticated", async () => {
    const request = new Request("http://localhost/api/organizationconfig", {
      method: "PUT",
      body: JSON.stringify({
        key: OrganizationConfigKey.Description,
        value: "x",
      }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when user has no active organization", async () => {
    const org = await createOrganization("cfg-put-no-active");
    const user = buildTestUser();
    const { headers } = await signUpAndGetSession(user);

    const request = new Request("http://localhost/api/organizationconfig", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        key: OrganizationConfigKey.Description,
        value: "x",
      }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("No active organization");
  });

  it("returns 403 when user is not admin or owner", async () => {
    const org = await createOrganization("cfg-put-no-admin");
    const user = buildTestUser();
    const { user: u, session, headers } = await signUpAndGetSession(user);
    await setActiveOrganization(session.id, org.id);
    // user is not a member or is member with insufficient role

    const request = new Request("http://localhost/api/organizationconfig", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        key: OrganizationConfigKey.Description,
        value: "x",
      }),
    });
    const response = await PUT(request);
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

    const request = new Request("http://localhost/api/organizationconfig", {
      method: "PUT",
      headers,
      body: JSON.stringify({ key: "not-a-key", value: "x" }),
    });
    const response = await PUT(request);
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

    const request = new Request("http://localhost/api/organizationconfig", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        key: OrganizationConfigKey.Description,
        value: "<b>bad</b>",
      }),
    });
    const response = await PUT(request);
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

    const request = new Request("http://localhost/api/organizationconfig", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        key: OrganizationConfigKey.Description,
        value: "Updated description",
      }),
    });
    const response = await PUT(request);
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
