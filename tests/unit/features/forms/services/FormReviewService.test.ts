// @vitest-environment node
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import db from "@/core/db";
import {
  FormStatus,
  SubmissionReviewStatus,
  formSubmissions,
  MemberType,
  OrganizationConfigKey,
  notifications,
} from "@/core/db/schema";
import { MembersService } from "@/features/membership/services/MemberService";
import { NotificationService } from "@/features/communications/services/NotificationService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { DEFAULT_FORM_SETTINGS } from "@/features/forms/lib/constants";
import { FormError } from "@/features/forms/lib/management";
import {
  FormReviewService,
  SubmissionNotFoundError,
} from "@/features/forms/services/FormReviewService";
import {
  buildTestUser,
  createForm,
  createFormSubmission,
  createOrganization,
  signUpAndGetSession,
  addMember,
} from "@/tests/unit/testUtils";

async function createUser() {
  const { user } = await signUpAndGetSession(buildTestUser());
  return user.id;
}

async function statusOf(id: string) {
  const [row] = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.id, id));
  return row;
}

describe("FormReviewService.setReviewStatus", () => {
  it("sets the status and who changed it", async () => {
    const org = await createOrganization("camp");
    const [adminId, applicantId] = [await createUser(), await createUser()];
    const form = await createForm(org.id, { status: FormStatus.Published });
    const id = await createFormSubmission(form, { userId: applicantId });

    const changes = await FormReviewService.setReviewStatus({
      organizationId: org.id,
      submissionIds: [id],
      status: SubmissionReviewStatus.Accepted,
      actorId: adminId,
    });

    expect(changes).toEqual([
      {
        id,
        formId: form.id,
        userId: applicantId,
        previousStatus: SubmissionReviewStatus.Pending,
        reviewStatus: SubmissionReviewStatus.Accepted,
        changed: true,
      },
    ]);
    const row = await statusOf(id);
    expect(row.reviewStatus).toBe(SubmissionReviewStatus.Accepted);
    expect(row.reviewStatusUpdatedBy).toBe(adminId);
    expect(row.reviewStatusUpdatedAt).toBeInstanceOf(Date);
  });

  it("leaves submissions that already have the status alone", async () => {
    const org = await createOrganization("camp");
    const adminId = await createUser();
    const form = await createForm(org.id, { status: FormStatus.Published });
    const id = await createFormSubmission(form, {
      reviewStatus: SubmissionReviewStatus.UnderReview,
    });

    const [change] = await FormReviewService.setReviewStatus({
      organizationId: org.id,
      submissionIds: [id],
      status: SubmissionReviewStatus.UnderReview,
      actorId: adminId,
    });

    expect(change.changed).toBe(false);
    expect((await statusOf(id)).reviewStatusUpdatedBy).toBeNull();
  });

  it("changes several submissions at once", async () => {
    const org = await createOrganization("camp");
    const adminId = await createUser();
    const form = await createForm(org.id, { status: FormStatus.Published });
    const ids = [
      await createFormSubmission(form),
      await createFormSubmission(form),
    ];

    const changes = await FormReviewService.setReviewStatus({
      organizationId: org.id,
      submissionIds: [...ids, ids[0]],
      status: SubmissionReviewStatus.Rejected,
      actorId: adminId,
    });

    expect(changes.map(({ id }) => id).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      expect((await statusOf(id)).reviewStatus).toBe(
        SubmissionReviewStatus.Rejected,
      );
    }
  });

  it("changes nothing when any submission is in another organization", async () => {
    const orgA = await createOrganization("camp-a");
    const orgB = await createOrganization("camp-b");
    const adminId = await createUser();
    const formA = await createForm(orgA.id, { status: FormStatus.Published });
    const formB = await createForm(orgB.id, { status: FormStatus.Published });
    const idA = await createFormSubmission(formA);
    const idB = await createFormSubmission(formB);

    await expect(
      FormReviewService.setReviewStatus({
        organizationId: orgB.id,
        submissionIds: [idB, idA],
        status: SubmissionReviewStatus.Accepted,
        actorId: adminId,
      }),
    ).rejects.toBeInstanceOf(SubmissionNotFoundError);

    expect((await statusOf(idA)).reviewStatus).toBe(
      SubmissionReviewStatus.Pending,
    );
    expect((await statusOf(idB)).reviewStatus).toBe(
      SubmissionReviewStatus.Pending,
    );
  });
});

afterEach(() => vi.restoreAllMocks());

async function reviewSetup({
  enabled = true,
  target = MemberType.Attendee as MemberType | null,
  role = "member",
} = {}) {
  const org = await createOrganization("review-camp");
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.MemberTypesEnabled,
    String(enabled),
  );
  const actorId = await createUser();
  const userId = await createUser();
  await addMember(userId, org.id, role, MemberType.Applicant);
  const form = await createForm(org.id, {
    status: FormStatus.Published,
    settings: { ...DEFAULT_FORM_SETTINGS, acceptedMemberType: target },
  });
  const id = await createFormSubmission(form, { userId });
  return {
    org,
    userId,
    form,
    id,
    input: {
      organizationId: org.id,
      submissionIds: [id],
      actorId,
      status: SubmissionReviewStatus.Accepted,
    },
  };
}

async function notices(organizationId: string) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.organizationId, organizationId));
}

describe("review side effects", () => {
  it("previews distinct people without writes, then accepts and notifies atomically", async () => {
    const { org, userId, id, form, input } = await reviewSetup();
    const preview = await FormReviewService.previewStatusChange(input);
    expect(preview).toEqual({ changed: 1, notified: 1, memberTypesChanged: 1 });
    expect((await statusOf(id)).reviewStatus).toBe(
      SubmissionReviewStatus.Pending,
    );
    expect(
      (await MembersService.findByUserAndOrganization(userId, org.id))
        ?.memberType,
    ).toBe(MemberType.Applicant);
    expect(await notices(org.id)).toHaveLength(0);
    await FormReviewService.setReviewStatus(input);
    expect(
      (await MembersService.findByUserAndOrganization(userId, org.id))
        ?.memberType,
    ).toBe(MemberType.Attendee);
    expect(await notices(org.id)).toEqual([
      expect.objectContaining({
        userId,
        text: expect.stringContaining(form.title),
        metadata: { kind: "form_review", href: "/", submissionId: id },
      }),
    ]);
    await FormReviewService.setReviewStatus(input);
    expect(await notices(org.id)).toHaveLength(1);
    expect(await FormReviewService.previewStatusChange(input)).toEqual({
      changed: 0,
      notified: 0,
      memberTypesChanged: 0,
    });
  });

  it.each([
    { enabled: false, target: MemberType.Attendee, role: "member" },
    { enabled: true, target: null, role: "member" },
    { enabled: true, target: MemberType.Attendee, role: "admin" },
    { enabled: true, target: MemberType.Attendee, role: "owner" },
  ])(
    "keeps member types for $role with enabled=$enabled and target=$target",
    async (options) => {
      const { org, userId, input } = await reviewSetup(options);
      expect(
        (await FormReviewService.previewStatusChange(input)).memberTypesChanged,
      ).toBe(0);
      await FormReviewService.setReviewStatus(input);
      expect(
        (await MembersService.findByUserAndOrganization(userId, org.id))
          ?.memberType,
      ).toBe(MemberType.Applicant);
      expect(await notices(org.id)).toHaveLength(1);
    },
  );

  it("skips guests and users without a membership, including another org's member", async () => {
    const { org, form, input } = await reviewSetup();
    const outsiderId = await createUser();
    const otherOrg = await createOrganization("other-camp");
    await addMember(outsiderId, otherOrg.id, "member", MemberType.Applicant);
    const outsider = await createFormSubmission(form, { userId: outsiderId });
    const guest = await createFormSubmission(form);
    const bulk = { ...input, submissionIds: [outsider, guest] };
    expect(await FormReviewService.previewStatusChange(bulk)).toEqual({
      changed: 2,
      notified: 1,
      memberTypesChanged: 0,
    });
    await FormReviewService.setReviewStatus(bulk);
    expect(await notices(org.id)).toHaveLength(1);
    expect(
      (await MembersService.findByUserAndOrganization(outsiderId, otherOrg.id))
        ?.memberType,
    ).toBe(MemberType.Applicant);
  });

  it("notifies only decision transitions and never reverses acceptance membership", async () => {
    const { org, userId, input } = await reviewSetup();
    for (const status of [
      SubmissionReviewStatus.UnderReview,
      SubmissionReviewStatus.Pending,
    ]) {
      await FormReviewService.setReviewStatus({ ...input, status });
    }
    expect(await notices(org.id)).toHaveLength(0);
    await FormReviewService.setReviewStatus(input);
    await FormReviewService.setReviewStatus({
      ...input,
      status: SubmissionReviewStatus.Rejected,
    });
    await FormReviewService.setReviewStatus({
      ...input,
      status: SubmissionReviewStatus.Rejected,
    });
    expect(await notices(org.id)).toHaveLength(2);
    expect(
      (await MembersService.findByUserAndOrganization(userId, org.id))
        ?.memberType,
    ).toBe(MemberType.Attendee);
    await FormReviewService.setReviewStatus(input);
    expect(await notices(org.id)).toHaveLength(3);
  });

  it("serializes concurrent decisions so only one transition notifies", async () => {
    const { org, input } = await reviewSetup();
    const results = await Promise.all([
      FormReviewService.setReviewStatus(input),
      FormReviewService.setReviewStatus(input),
    ]);
    expect(results.flat().filter((change) => change.changed)).toHaveLength(1);
    expect(await notices(org.id)).toHaveLength(1);
  });

  it("rolls back status, audit fields, and membership when notification creation fails", async () => {
    const { org, userId, id, form, input } = await reviewSetup();
    // Fail after the first insert to verify inserted notifications roll back too.
    const notify = NotificationService.notify;
    vi.spyOn(NotificationService, "notify")
      .mockImplementationOnce(notify)
      .mockRejectedValueOnce(new Error("notification failed"));
    const another = await createFormSubmission(form, { userId });
    await expect(
      FormReviewService.setReviewStatus({
        ...input,
        submissionIds: [id, another],
      }),
    ).rejects.toThrow("notification failed");
    expect(await statusOf(id)).toMatchObject({
      reviewStatus: SubmissionReviewStatus.Pending,
      reviewStatusUpdatedAt: null,
      reviewStatusUpdatedBy: null,
    });
    expect(
      (await MembersService.findByUserAndOrganization(userId, org.id))
        ?.memberType,
    ).toBe(MemberType.Applicant);
    expect(await notices(org.id)).toHaveLength(0);
    expect((await statusOf(another)).reviewStatus).toBe(
      SubmissionReviewStatus.Pending,
    );
  });

  it("rejects a mixed-tenant bulk operation before any side effects", async () => {
    const a = await reviewSetup();
    const b = await createOrganization("other");
    const form = await createForm(b.id);
    const foreign = await createFormSubmission(form);
    const input = { ...a.input, submissionIds: [a.id, foreign] };
    await expect(
      FormReviewService.previewStatusChange(input),
    ).rejects.toBeInstanceOf(SubmissionNotFoundError);
    await expect(
      FormReviewService.setReviewStatus(input),
    ).rejects.toBeInstanceOf(SubmissionNotFoundError);
    expect((await statusOf(a.id)).reviewStatus).toBe(
      SubmissionReviewStatus.Pending,
    );
    expect(
      (await MembersService.findByUserAndOrganization(a.userId, a.org.id))
        ?.memberType,
    ).toBe(MemberType.Applicant);
    expect(await notices(a.org.id)).toHaveLength(0);
  });

  it("counts people once when multiple submissions are selected", async () => {
    const { userId, form, id, input } = await reviewSetup();
    const second = await createFormSubmission(form, { userId });
    expect(
      await FormReviewService.previewStatusChange({
        ...input,
        submissionIds: [id, second, id],
      }),
    ).toEqual({ changed: 2, notified: 1, memberTypesChanged: 1 });
  });
});

describe("FormReviewService.listResponses", () => {
  it("filters, searches name and email literally, counts statuses, and paginates", async () => {
    const org = await createOrganization("list-camp");
    const form = await createForm(org.id);
    const { user } = await signUpAndGetSession({
      ...buildTestUser(),
      name: "Ada 100%_Student",
    });
    const older = await createFormSubmission(form, {
      userId: user.id,
      submittedAt: new Date("2030-01-01"),
      updatedAt: new Date("2030-01-03"),
    });
    const newer = await createFormSubmission(form, {
      userId: user.id,
      reviewStatus: SubmissionReviewStatus.Accepted,
      submittedAt: new Date("2030-01-02"),
    });
    await createFormSubmission(form);
    const result = await FormReviewService.listResponses(org.id, form.formId, {
      search: "aDA 100%_",
      limit: 1,
      offset: 0,
    });
    expect(result.total).toBe(2);
    expect(result.rows.map((row) => row.id)).toEqual([newer]);
    expect(result.counts).toMatchObject({
      pending: 1,
      accepted: 1,
      rejected: 0,
      under_review: 0,
    });
    const second = await FormReviewService.listResponses(org.id, form.formId, {
      search: user.email.toUpperCase(),
      limit: 1,
      offset: 1,
    });
    expect(second.rows[0]).toMatchObject({
      id: older,
      name: user.name,
      email: user.email,
      updatedAt: new Date("2030-01-03"),
    });
    const pending = await FormReviewService.listResponses(org.id, form.formId, {
      search: user.email,
      status: SubmissionReviewStatus.Pending,
      limit: 25,
      offset: 0,
    });
    expect(pending.total).toBe(1);
    expect(pending.counts.accepted).toBe(1);
    expect(
      (
        await FormReviewService.listResponses(org.id, form.formId, {
          search: "missing",
          limit: 25,
          offset: 0,
        })
      ).total,
    ).toBe(0);
    const all = await FormReviewService.listResponses(org.id, form.formId, {
      limit: 25,
      offset: 0,
    });
    expect(all.total).toBe(3);
    expect(
      all.rows.some((row) => row.userId === null && row.email === null),
    ).toBe(true);
  });

  it("isolates same-key forms in different organizations and distinguishes absent forms", async () => {
    const a = await createOrganization("list-a");
    const b = await createOrganization("list-b");
    const formA = await createForm(a.id, { formId: "shared" });
    await createForm(b.id, { formId: "shared" });
    await createFormSubmission(formA);
    expect(
      (
        await FormReviewService.listResponses(b.id, "shared", {
          limit: 25,
          offset: 0,
        })
      ).total,
    ).toBe(0);
    await expect(
      FormReviewService.listResponses(b.id, "missing", {
        limit: 25,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(FormError);
    expect(
      await db
        .select()
        .from(formSubmissions)
        .where(
          and(
            eq(formSubmissions.organizationId, a.id),
            eq(formSubmissions.formId, formA.id),
          ),
        ),
    ).toHaveLength(1);
  });
});
