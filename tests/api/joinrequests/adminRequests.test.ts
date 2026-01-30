import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { GET, PATCH } from "@/app/api/joinrequests/route";
import db from "@/lib/db";
import { joinRequests, members } from "@/lib/schema";
import {
  addMember,
  buildTestUser,
  createJoinRequest,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "../../helpers/joinRequests";

describe("GET /api/joinrequests (paginated list)", () => {
  it("returns 401 when user is not authenticated", async () => {
    const request = new Request("http://localhost/api/joinrequests");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when user has no active organization", async () => {
    const user = buildTestUser();
    const { headers } = await signUpAndGetSession(user);

    const request = new Request("http://localhost/api/joinrequests", {
      headers,
    });
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("No active organization");
  });

  it("returns 403 when user is not admin or owner", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();
    const { session, headers } = await signUpAndGetSession(user);

    await setActiveOrganization(session.id, organization.id);
    await addMember(session.userId, organization.id, "member");

    const request = new Request("http://localhost/api/joinrequests", {
      headers,
    });
    const response = await GET(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Forbidden: Admin or owner role required");
  });

  it("returns join requests when user is admin", async () => {
    const organization = await createOrganization("acme");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);

    await setActiveOrganization(session.id, organization.id);
    await addMember(admin.id, organization.id, "admin");

    // Create some join requests from other users
    const otherUser1 = buildTestUser();
    const { user: other1 } = await signUpAndGetSession(otherUser1);
    await createJoinRequest(other1.id, organization.id, "pending");

    const otherUser2 = buildTestUser();
    const { user: other2 } = await signUpAndGetSession(otherUser2);
    await createJoinRequest(other2.id, organization.id, "approved");

    const request = new Request("http://localhost/api/joinrequests", {
      headers,
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(2);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
  });

  it("returns join requests when user is owner", async () => {
    const organization = await createOrganization("acme");
    const ownerUser = buildTestUser();
    const {
      user: owner,
      session,
      headers,
    } = await signUpAndGetSession(ownerUser);

    await setActiveOrganization(session.id, organization.id);
    await addMember(owner.id, organization.id, "owner");

    const otherUser = buildTestUser();
    const { user: other } = await signUpAndGetSession(otherUser);
    await createJoinRequest(other.id, organization.id, "pending");

    const request = new Request("http://localhost/api/joinrequests", {
      headers,
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
  });

  it("paginates results correctly", async () => {
    const organization = await createOrganization("acme");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);

    await setActiveOrganization(session.id, organization.id);
    await addMember(admin.id, organization.id, "admin");

    // Create 5 join requests
    for (let i = 0; i < 5; i++) {
      const otherUser = buildTestUser();
      const { user: other } = await signUpAndGetSession(otherUser);
      await createJoinRequest(other.id, organization.id, "pending");
    }

    // Request page 1 with pageSize 2
    const request1 = new Request(
      "http://localhost/api/joinrequests?page=1&pageSize=2",
      { headers },
    );
    const response1 = await GET(request1);
    const data1 = await response1.json();

    expect(response1.status).toBe(200);
    expect(data1.data).toHaveLength(2);
    expect(data1.page).toBe(1);
    expect(data1.pageSize).toBe(2);

    // Request page 2 with pageSize 2
    const request2 = new Request(
      "http://localhost/api/joinrequests?page=2&pageSize=2",
      { headers },
    );
    const response2 = await GET(request2);
    const data2 = await response2.json();

    expect(response2.status).toBe(200);
    expect(data2.data).toHaveLength(2);
    expect(data2.page).toBe(2);

    // Request page 3 with pageSize 2 (should have 1 item)
    const request3 = new Request(
      "http://localhost/api/joinrequests?page=3&pageSize=2",
      { headers },
    );
    const response3 = await GET(request3);
    const data3 = await response3.json();

    expect(response3.status).toBe(200);
    expect(data3.data).toHaveLength(1);
    expect(data3.page).toBe(3);
  });

  it("uses default pagination values when not provided", async () => {
    const organization = await createOrganization("acme");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);

    await setActiveOrganization(session.id, organization.id);
    await addMember(admin.id, organization.id, "admin");

    const request = new Request("http://localhost/api/joinrequests", {
      headers,
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
  });
});

describe("PATCH /api/joinrequests", () => {
  it("returns 401 when user is not authenticated", async () => {
    const request = new Request(
      "http://localhost/api/joinrequests?id=test&status=approved",
      {
        method: "PATCH",
      },
    );
    const response = await PATCH(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when user has no active organization", async () => {
    const user = buildTestUser();
    const { headers } = await signUpAndGetSession(user);

    const request = new Request(
      "http://localhost/api/joinrequests?id=test&status=approved",
      {
        method: "PATCH",
        headers,
      },
    );
    const response = await PATCH(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("No active organization");
  });

  it("returns 403 when user is not admin or owner", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();
    const { session, headers } = await signUpAndGetSession(user);

    await setActiveOrganization(session.id, organization.id);
    await addMember(session.userId, organization.id, "member");

    const request = new Request(
      "http://localhost/api/joinrequests?id=test&status=approved",
      {
        method: "PATCH",
        headers,
      },
    );
    const response = await PATCH(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Forbidden: Admin or owner role required");
  });

  it("returns 400 when missing required parameters", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();
    const { user: admin, session, headers } = await signUpAndGetSession(user);

    await setActiveOrganization(session.id, organization.id);
    await addMember(admin.id, organization.id, "admin");

    const request = new Request("http://localhost/api/joinrequests", {
      method: "PATCH",
      headers,
    });
    const response = await PATCH(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Missing required parameters: id and status");
  });

  it("returns 400 when status is invalid", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();
    const { user: admin, session, headers } = await signUpAndGetSession(user);

    await setActiveOrganization(session.id, organization.id);
    await addMember(admin.id, organization.id, "admin");

    const request = new Request(
      "http://localhost/api/joinrequests?id=test&status=invalid",
      {
        method: "PATCH",
        headers,
      },
    );
    const response = await PATCH(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe(
      "Invalid status. Must be pending, approved, or denied",
    );
  });

  it("returns 404 when join request does not exist", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();
    const { user: admin, session, headers } = await signUpAndGetSession(user);

    await setActiveOrganization(session.id, organization.id);
    await addMember(admin.id, organization.id, "admin");

    const request = new Request(
      "http://localhost/api/joinrequests?id=nonexistent&status=approved",
      {
        method: "PATCH",
        headers,
      },
    );
    const response = await PATCH(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Join request not found");
  });

  it("returns 404 when join request belongs to different organization", async () => {
    const organization1 = await createOrganization("acme");
    const organization2 = await createOrganization("other");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);

    await setActiveOrganization(session.id, organization1.id);
    await addMember(admin.id, organization1.id, "admin");

    // Create a join request for a different organization
    const requesterUser = buildTestUser();
    const { user: requester } = await signUpAndGetSession(requesterUser);
    const joinRequestId = await createJoinRequest(
      requester.id,
      organization2.id,
      "pending",
    );

    const request = new Request(
      `http://localhost/api/joinrequests?id=${joinRequestId}&status=approved`,
      {
        method: "PATCH",
        headers,
      },
    );
    const response = await PATCH(request);

    expect(response.status).toBe(404);
  });

  it("does not change status when already approved", async () => {
    const organization = await createOrganization("acme");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);

    await setActiveOrganization(session.id, organization.id);
    await addMember(admin.id, organization.id, "admin");

    const requesterUser = buildTestUser();
    const { user: requester } = await signUpAndGetSession(requesterUser);
    const joinRequestId = await createJoinRequest(
      requester.id,
      organization.id,
      "approved",
    );

    const request = new Request(
      `http://localhost/api/joinrequests?id=${joinRequestId}&status=denied`,
      {
        method: "PATCH",
        headers,
      },
    );
    const response = await PATCH(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("Join request is already approved");

    // Verify status is still approved
    const [unchangedRequest] = await db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.id, joinRequestId));
    expect(unchangedRequest.status).toBe("approved");
  });

  it("updates status to denied", async () => {
    const organization = await createOrganization("acme");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);

    await setActiveOrganization(session.id, organization.id);
    await addMember(admin.id, organization.id, "admin");

    const requesterUser = buildTestUser();
    const { user: requester } = await signUpAndGetSession(requesterUser);
    const joinRequestId = await createJoinRequest(
      requester.id,
      organization.id,
      "pending",
    );

    const request = new Request(
      `http://localhost/api/joinrequests?id=${joinRequestId}&status=denied`,
      {
        method: "PATCH",
        headers,
      },
    );
    const response = await PATCH(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("denied");

    // Verify user is NOT added as member
    const [membership] = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.userId, requester.id),
          eq(members.organizationId, organization.id),
        ),
      );
    expect(membership).toBeUndefined();
  });

  it("approves request and adds user to organization", async () => {
    const organization = await createOrganization("acme");
    const adminUser = buildTestUser();
    const {
      user: admin,
      session,
      headers,
    } = await signUpAndGetSession(adminUser);

    await setActiveOrganization(session.id, organization.id);
    await addMember(admin.id, organization.id, "admin");

    const requesterUser = buildTestUser();
    const { user: requester } = await signUpAndGetSession(requesterUser);
    const joinRequestId = await createJoinRequest(
      requester.id,
      organization.id,
      "pending",
    );

    const request = new Request(
      `http://localhost/api/joinrequests?id=${joinRequestId}&status=approved`,
      {
        method: "PATCH",
        headers,
      },
    );
    const response = await PATCH(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("approved");

    // Verify user is added as member
    const [membership] = await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.userId, requester.id),
          eq(members.organizationId, organization.id),
        ),
      );
    expect(membership).toBeDefined();
    expect(membership.role).toBe("member");
  });

  it("owner can also approve requests", async () => {
    const organization = await createOrganization("acme");
    const ownerUser = buildTestUser();
    const {
      user: owner,
      session,
      headers,
    } = await signUpAndGetSession(ownerUser);

    await setActiveOrganization(session.id, organization.id);
    await addMember(owner.id, organization.id, "owner");

    const requesterUser = buildTestUser();
    const { user: requester } = await signUpAndGetSession(requesterUser);
    const joinRequestId = await createJoinRequest(
      requester.id,
      organization.id,
      "pending",
    );

    const request = new Request(
      `http://localhost/api/joinrequests?id=${joinRequestId}&status=approved`,
      {
        method: "PATCH",
        headers,
      },
    );
    const response = await PATCH(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("approved");
  });
});
