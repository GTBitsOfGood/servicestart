// @vitest-environment node
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  joinRequestHistory,
  joinRequests,
  JoinRequestStatus,
} from "@/lib/schema";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import { MembersService } from "@/lib/services/MemberService";
import NotificationService from "@/lib/services/NotificationService";
import {
  addMember,
  buildTestUser,
  createJoinRequest,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

async function createAdmin(organizationId: string) {
  const { user, session, headers } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, organizationId, "admin");
  await setActiveOrganization(session.id, organizationId);
  return { user, headers: new Headers(headers) };
}

async function listNotificationTexts(userId: string, organizationId: string) {
  const notifications = await NotificationService.listByUserAndOrganization(
    userId,
    organizationId,
    "all",
    undefined,
    { limit: 50, offset: 0 },
  );
  return notifications.map((notification) => notification.text);
}

describe("JoinRequestsService.create", () => {
  it("creates a pending join request and returns its id", async () => {
    const org = await createOrganization("create-pending");
    const { user } = await signUpAndGetSession(buildTestUser());

    const id = await JoinRequestsService.create(user.id, org.id);

    const [row] = await db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.id, id));
    expect(row).toMatchObject({
      id,
      userId: user.id,
      organizationId: org.id,
      status: JoinRequestStatus.Pending,
      denialReason: null,
    });
  });
});

describe("JoinRequestsService.findByUserAndOrganization", () => {
  it("returns the user's join request for the organization", async () => {
    const org = await createOrganization("find-user-org");
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(user.id, org.id);

    const result = await JoinRequestsService.findByUserAndOrganization(
      user.id,
      org.id,
    );

    expect(result).toMatchObject({ id, status: JoinRequestStatus.Pending });
    expect(result?.createdAt).toBeInstanceOf(Date);
  });

  it("returns null when the user has no join request", async () => {
    const org = await createOrganization("find-user-none");
    const { user } = await signUpAndGetSession(buildTestUser());

    const result = await JoinRequestsService.findByUserAndOrganization(
      user.id,
      org.id,
    );

    expect(result).toBeNull();
  });

  it("does not return a join request from another organization", async () => {
    const orgA = await createOrganization("find-user-a");
    const orgB = await createOrganization("find-user-b");
    const { user } = await signUpAndGetSession(buildTestUser());
    await createJoinRequest(user.id, orgA.id);

    const result = await JoinRequestsService.findByUserAndOrganization(
      user.id,
      orgB.id,
    );

    expect(result).toBeNull();
  });
});

describe("JoinRequestsService.findByIdAndOrganization", () => {
  it("returns the join request when it belongs to the organization", async () => {
    const org = await createOrganization("find-id-match");
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(user.id, org.id);

    const result = await JoinRequestsService.findByIdAndOrganization(
      id,
      org.id,
    );

    expect(result).toEqual({
      id,
      userId: user.id,
      organizationId: org.id,
      status: JoinRequestStatus.Pending,
    });
  });

  it("returns null when the join request belongs to another organization", async () => {
    const orgA = await createOrganization("find-id-a");
    const orgB = await createOrganization("find-id-b");
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(user.id, orgA.id);

    const result = await JoinRequestsService.findByIdAndOrganization(
      id,
      orgB.id,
    );

    expect(result).toBeNull();
  });

  it("returns null when the join request does not exist", async () => {
    const org = await createOrganization("find-id-missing");

    const result = await JoinRequestsService.findByIdAndOrganization(
      "missing-id",
      org.id,
    );

    expect(result).toBeNull();
  });
});

describe("JoinRequestsService.findById", () => {
  it("returns the join request", async () => {
    const org = await createOrganization("find-by-id");
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(
      user.id,
      org.id,
      JoinRequestStatus.Denied,
    );

    const result = await JoinRequestsService.findById(id);

    expect(result).toEqual({
      id,
      userId: user.id,
      organizationId: org.id,
      status: JoinRequestStatus.Denied,
    });
  });

  it("returns null when the join request does not exist", async () => {
    const result = await JoinRequestsService.findById("missing-id");
    expect(result).toBeNull();
  });
});

describe("JoinRequestsService.listByOrganization", () => {
  it("returns an empty array when the organization has no join requests", async () => {
    const org = await createOrganization("list-empty");

    const result = await JoinRequestsService.listByOrganization(org.id);

    expect(result).toEqual([]);
  });

  it("returns join requests with user details, history, and organization name", async () => {
    const org = await createOrganization("list-fields");
    const admin = await createAdmin(org.id);
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(
      user.id,
      org.id,
      JoinRequestStatus.Denied,
    );
    await JoinRequestsService.addHistoryEntry(
      id,
      "denied",
      admin.user.id,
      "Incomplete profile",
    );

    const result = await JoinRequestsService.listByOrganization(org.id);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id,
      status: JoinRequestStatus.Denied,
      organizationId: org.id,
      organization: `Organization ${org.slug}`,
      user: { id: user.id, name: user.name, email: user.email },
    });
    expect(result[0].history).toHaveLength(1);
    expect(result[0].history[0]).toMatchObject({
      action: "denied",
      resolvedByName: admin.user.name,
      denialReason: "Incomplete profile",
    });
  });

  it("orders join requests newest first", async () => {
    const org = await createOrganization("list-order");
    const { user: older } = await signUpAndGetSession(buildTestUser());
    const { user: newer } = await signUpAndGetSession(buildTestUser());
    const olderId = await createJoinRequest(older.id, org.id);
    const newerId = await createJoinRequest(newer.id, org.id);
    await db
      .update(joinRequests)
      .set({ createdAt: new Date("2025-01-01T00:00:00Z") })
      .where(eq(joinRequests.id, olderId));

    const result = await JoinRequestsService.listByOrganization(org.id);

    expect(result.map((jr) => jr.id)).toEqual([newerId, olderId]);
  });

  it("respects the limit option", async () => {
    const org = await createOrganization("list-limit");
    for (let i = 0; i < 3; i++) {
      const { user } = await signUpAndGetSession(buildTestUser());
      await createJoinRequest(user.id, org.id);
    }

    const result = await JoinRequestsService.listByOrganization(org.id, {
      limit: 2,
    });

    expect(result).toHaveLength(2);
  });

  it("returns the next page when an offset is given", async () => {
    const org = await createOrganization("list-offset");
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const { user } = await signUpAndGetSession(buildTestUser());
      const id = await createJoinRequest(user.id, org.id);
      await db
        .update(joinRequests)
        .set({ createdAt: new Date(Date.UTC(2025, 0, 4 - i)) })
        .where(eq(joinRequests.id, id));
      ids.push(id);
    }

    const page1 = await JoinRequestsService.listByOrganization(org.id, {
      limit: 2,
      offset: 0,
    });
    const page2 = await JoinRequestsService.listByOrganization(org.id, {
      limit: 2,
      offset: 2,
    });

    expect(page1.map((jr) => jr.id)).toEqual(ids.slice(0, 2));
    expect(page2.map((jr) => jr.id)).toEqual(ids.slice(2, 4));
  });

  it("only returns join requests for the given organization", async () => {
    const orgA = await createOrganization("list-a");
    const orgB = await createOrganization("list-b");
    const { user: userA } = await signUpAndGetSession(buildTestUser());
    const { user: userB } = await signUpAndGetSession(buildTestUser());
    const idA = await createJoinRequest(userA.id, orgA.id);
    await createJoinRequest(userB.id, orgB.id);

    const result = await JoinRequestsService.listByOrganization(orgA.id);

    expect(result.map((jr) => jr.id)).toEqual([idA]);
  });
});

describe("JoinRequestsService.listHistory", () => {
  it("returns history entries newest first with the resolver's name", async () => {
    const org = await createOrganization("history-order");
    const admin = await createAdmin(org.id);
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(user.id, org.id);
    await JoinRequestsService.addHistoryEntry(id, "approved", admin.user.id);
    await JoinRequestsService.addHistoryEntry(id, "removed", admin.user.id);
    await db
      .update(joinRequestHistory)
      .set({ resolvedAt: new Date("2025-01-01T00:00:00Z") })
      .where(
        and(
          eq(joinRequestHistory.joinRequestId, id),
          eq(joinRequestHistory.action, "approved"),
        ),
      );

    const history = await JoinRequestsService.listHistory(id);

    expect(history.map((entry) => entry.action)).toEqual([
      "removed",
      "approved",
    ]);
    expect(history[0].resolvedByName).toBe(admin.user.name);
    expect(history[0].denialReason).toBeNull();
  });

  it("returns an empty array when there is no history", async () => {
    const org = await createOrganization("history-empty");
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(user.id, org.id);

    const history = await JoinRequestsService.listHistory(id);

    expect(history).toEqual([]);
  });

  it("does not include history from other join requests", async () => {
    const org = await createOrganization("history-scope");
    const admin = await createAdmin(org.id);
    const { user: userA } = await signUpAndGetSession(buildTestUser());
    const { user: userB } = await signUpAndGetSession(buildTestUser());
    const idA = await createJoinRequest(userA.id, org.id);
    const idB = await createJoinRequest(userB.id, org.id);
    await JoinRequestsService.addHistoryEntry(idB, "approved", admin.user.id);

    const history = await JoinRequestsService.listHistory(idA);

    expect(history).toEqual([]);
  });
});

describe("JoinRequestsService.updateStatus", () => {
  it("approves a pending request, adds the member, and notifies the user", async () => {
    const org = await createOrganization("update-approve");
    const admin = await createAdmin(org.id);
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(user.id, org.id);

    const result = await JoinRequestsService.updateStatus(
      id,
      JoinRequestStatus.Approved,
      admin.user.id,
      admin.headers,
      undefined,
      JoinRequestStatus.Pending,
    );

    expect(result?.status).toBe(JoinRequestStatus.Approved);
    const membership = await MembersService.findByUserAndOrganization(
      user.id,
      org.id,
    );
    expect(membership).not.toBeNull();

    const texts = await listNotificationTexts(user.id, org.id);
    expect(texts).toEqual([
      `Join Request Approved\nYour request to join Organization ${org.slug} has been approved.`,
    ]);

    const history = await JoinRequestsService.listHistory(id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      action: "approved",
      resolvedByName: admin.user.name,
    });
  });

  it("denies a pending request with a reason and includes it in the notification", async () => {
    const org = await createOrganization("update-deny");
    const admin = await createAdmin(org.id);
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(user.id, org.id);

    const result = await JoinRequestsService.updateStatus(
      id,
      JoinRequestStatus.Denied,
      admin.user.id,
      admin.headers,
      "  Not in service area  ",
      JoinRequestStatus.Pending,
    );

    expect(result?.status).toBe(JoinRequestStatus.Denied);
    expect(result?.denialReason).toBe("  Not in service area  ");
    expect(
      await MembersService.findByUserAndOrganization(user.id, org.id),
    ).toBeNull();

    const texts = await listNotificationTexts(user.id, org.id);
    expect(texts).toEqual([
      `Join Request Denied\nYour request to join Organization ${org.slug} was denied.\nReason: Not in service area`,
    ]);

    const history = await JoinRequestsService.listHistory(id);
    expect(history[0]).toMatchObject({
      action: "denied",
      denialReason: "  Not in service area  ",
    });
  });

  it("omits the reason line when a request is denied without a reason", async () => {
    const org = await createOrganization("update-deny-blank");
    const admin = await createAdmin(org.id);
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(user.id, org.id);

    await JoinRequestsService.updateStatus(
      id,
      JoinRequestStatus.Denied,
      admin.user.id,
      admin.headers,
      "   ",
      JoinRequestStatus.Pending,
    );

    const texts = await listNotificationTexts(user.id, org.id);
    expect(texts).toEqual([
      `Join Request Denied\nYour request to join Organization ${org.slug} was denied.`,
    ]);
  });

  it("removes membership when an approved request is moved back to pending", async () => {
    const org = await createOrganization("update-remove");
    const admin = await createAdmin(org.id);
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(
      user.id,
      org.id,
      JoinRequestStatus.Approved,
    );
    await addMember(user.id, org.id, "member");

    const result = await JoinRequestsService.updateStatus(
      id,
      JoinRequestStatus.Pending,
      admin.user.id,
      admin.headers,
      undefined,
      JoinRequestStatus.Approved,
    );

    expect(result?.status).toBe(JoinRequestStatus.Pending);
    expect(
      await MembersService.findByUserAndOrganization(user.id, org.id),
    ).toBeNull();

    const texts = await listNotificationTexts(user.id, org.id);
    expect(texts).toEqual([
      `Access Removed\nYour access to Organization ${org.slug} has been removed.`,
    ]);

    const history = await JoinRequestsService.listHistory(id);
    expect(history[0].action).toBe("removed");
  });

  it("does not notify when the status is unchanged but still records history", async () => {
    const org = await createOrganization("update-same");
    const admin = await createAdmin(org.id);
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(
      user.id,
      org.id,
      JoinRequestStatus.Denied,
    );

    await JoinRequestsService.updateStatus(
      id,
      JoinRequestStatus.Denied,
      admin.user.id,
      admin.headers,
      "Still no",
      JoinRequestStatus.Denied,
    );

    expect(await listNotificationTexts(user.id, org.id)).toEqual([]);
    expect(await JoinRequestsService.listHistory(id)).toHaveLength(1);
  });

  it("only updates the given join request", async () => {
    const orgA = await createOrganization("update-a");
    const orgB = await createOrganization("update-b");
    const admin = await createAdmin(orgA.id);
    const { user } = await signUpAndGetSession(buildTestUser());
    const idA = await createJoinRequest(user.id, orgA.id);
    const idB = await createJoinRequest(user.id, orgB.id);

    await JoinRequestsService.updateStatus(
      idA,
      JoinRequestStatus.Denied,
      admin.user.id,
      admin.headers,
      undefined,
      JoinRequestStatus.Pending,
    );

    expect((await JoinRequestsService.findById(idB))?.status).toBe(
      JoinRequestStatus.Pending,
    );
    expect(await listNotificationTexts(user.id, orgB.id)).toEqual([]);
    expect(await JoinRequestsService.listHistory(idB)).toEqual([]);
  });
});

describe("JoinRequestsService.deleteById", () => {
  it("deletes the join request and its history", async () => {
    const org = await createOrganization("delete");
    const admin = await createAdmin(org.id);
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createJoinRequest(user.id, org.id);
    await JoinRequestsService.addHistoryEntry(id, "denied", admin.user.id);

    await JoinRequestsService.deleteById(id);

    expect(await JoinRequestsService.findById(id)).toBeNull();
    expect(await JoinRequestsService.listHistory(id)).toEqual([]);
  });

  it("does not delete other join requests", async () => {
    const org = await createOrganization("delete-scope");
    const { user: userA } = await signUpAndGetSession(buildTestUser());
    const { user: userB } = await signUpAndGetSession(buildTestUser());
    const idA = await createJoinRequest(userA.id, org.id);
    const idB = await createJoinRequest(userB.id, org.id);

    await JoinRequestsService.deleteById(idA);

    expect(await JoinRequestsService.findById(idB)).not.toBeNull();
  });
});
