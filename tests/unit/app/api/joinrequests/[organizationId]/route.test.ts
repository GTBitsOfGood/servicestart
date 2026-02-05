import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { GET, DELETE } from "@/app/api/joinrequests/[organizationId]/route";
import db from "@/lib/db";
import { joinRequests, JoinRequestStatus } from "@/lib/schema";
import {
  buildTestUser,
  createJoinRequest,
  createOrganization,
  signUpAndGetHeaders,
} from "../../../../testUtils";

describe("GET /api/joinrequests/[organizationId]", () => {
  it("returns the join request status for an authenticated user", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();

    const { user: createdUser, headers } = await signUpAndGetHeaders(user);

    await db.insert(joinRequests).values({
      id: randomUUID(),
      userId: createdUser.id,
      organizationId: organization.id,
      status: JoinRequestStatus.Pending,
    });

    const request = new Request(
      `http://localhost/api/joinrequests/${organization.id}`,
      { headers },
    );

    const response = await GET(request, {
      params: Promise.resolve({ organizationId: organization.id }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe(JoinRequestStatus.Pending);
    expect(data.id).toBeDefined();
    expect(data.createdAt).toBeDefined();
  });

  it("returns 401 when user is not authenticated", async () => {
    const organization = await createOrganization("acme");

    const request = new Request(
      `http://localhost/api/joinrequests/${organization.id}`,
    );

    const response = await GET(request, {
      params: Promise.resolve({ organizationId: organization.id }),
    });

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 when no join request exists", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();

    const { headers } = await signUpAndGetHeaders(user);

    const request = new Request(
      `http://localhost/api/joinrequests/${organization.id}`,
      { headers },
    );

    const response = await GET(request, {
      params: Promise.resolve({ organizationId: organization.id }),
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe("Join request not found");
  });

  it("returns the correct status when join request is approved", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();

    const { user: createdUser, headers } = await signUpAndGetHeaders(user);

    await db.insert(joinRequests).values({
      id: randomUUID(),
      userId: createdUser.id,
      organizationId: organization.id,
      status: JoinRequestStatus.Approved,
    });

    const request = new Request(
      `http://localhost/api/joinrequests/${organization.id}`,
      { headers },
    );

    const response = await GET(request, {
      params: Promise.resolve({ organizationId: organization.id }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe(JoinRequestStatus.Approved);
  });
});

describe("DELETE /api/joinrequests/[organizationId]", () => {
  it("returns 401 when user is not authenticated", async () => {
    const organization = await createOrganization("acme");

    const request = new Request(
      `http://localhost/api/joinrequests/${organization.id}`,
      { method: "DELETE" },
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ organizationId: organization.id }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 when no join request exists", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();
    const { headers } = await signUpAndGetHeaders(user);

    const request = new Request(
      `http://localhost/api/joinrequests/${organization.id}`,
      { method: "DELETE", headers },
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ organizationId: organization.id }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Join request not found");
  });

  it("returns 403 when join request is not pending (approved)", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();
    const { user: createdUser, headers } = await signUpAndGetHeaders(user);

    await createJoinRequest(
      createdUser.id,
      organization.id,
      JoinRequestStatus.Approved,
    );

    const request = new Request(
      `http://localhost/api/joinrequests/${organization.id}`,
      { method: "DELETE", headers },
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ organizationId: organization.id }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Cannot delete a non-pending join request");

    // Verify request still exists
    const [existingRequest] = await db
      .select()
      .from(joinRequests)
      .where(
        and(
          eq(joinRequests.userId, createdUser.id),
          eq(joinRequests.organizationId, organization.id),
        ),
      );
    expect(existingRequest).toBeDefined();
  });

  it("returns 403 when join request is not pending (denied)", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();
    const { user: createdUser, headers } = await signUpAndGetHeaders(user);

    await createJoinRequest(
      createdUser.id,
      organization.id,
      JoinRequestStatus.Denied,
    );

    const request = new Request(
      `http://localhost/api/joinrequests/${organization.id}`,
      { method: "DELETE", headers },
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ organizationId: organization.id }),
    });

    expect(response.status).toBe(403);
  });

  it("successfully deletes a pending join request", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();
    const { user: createdUser, headers } = await signUpAndGetHeaders(user);

    await createJoinRequest(
      createdUser.id,
      organization.id,
      JoinRequestStatus.Pending,
    );

    const request = new Request(
      `http://localhost/api/joinrequests/${organization.id}`,
      { method: "DELETE", headers },
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ organizationId: organization.id }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify request is deleted
    const [deletedRequest] = await db
      .select()
      .from(joinRequests)
      .where(
        and(
          eq(joinRequests.userId, createdUser.id),
          eq(joinRequests.organizationId, organization.id),
        ),
      );
    expect(deletedRequest).toBeUndefined();
  });
});
