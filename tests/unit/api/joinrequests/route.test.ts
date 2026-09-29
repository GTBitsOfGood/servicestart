// @vitest-environment node
import { describe, expect, it } from "vitest";
import { JoinRequestStatus } from "@/lib/schema";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import {
  addMember,
  buildTestUser,
  createJoinRequest,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

async function createAdmin(organizationId: string) {
  const { user, session, headers } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, organizationId, "admin");
  await setActiveOrganization(session.id, organizationId);
  return { user, headers };
}

describe("PATCH /api/joinRequests", () => {
  it("updates a join request in the admin's organization", async () => {
    const org = await createOrganization("patch-same-org");
    const admin = await createAdmin(org.id);
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(user.id, org.id);

    const response = await testApi.joinRequests.$patch(
      { query: { id, status: JoinRequestStatus.Denied } },
      { headers: admin.headers },
    );

    expect(response.status).toBe(200);
    expect((await JoinRequestsService.findById(id))?.status).toBe(
      JoinRequestStatus.Denied,
    );
  });

  it("returns 404 for a join request in another organization and leaves it unchanged", async () => {
    const orgA = await createOrganization("patch-org-a");
    const orgB = await createOrganization("patch-org-b");
    const admin = await createAdmin(orgA.id);
    const { user } = await signUpAndGetSession(buildTestUser());
    const idB = await createJoinRequest(user.id, orgB.id);

    const response = await testApi.joinRequests.$patch(
      { query: { id: idB, status: JoinRequestStatus.Denied } },
      { headers: admin.headers },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toHaveProperty(
      "error",
      "Join request not found",
    );
    expect((await JoinRequestsService.findById(idB))?.status).toBe(
      JoinRequestStatus.Pending,
    );
    expect(await JoinRequestsService.listHistory(idB)).toEqual([]);
  });
});
