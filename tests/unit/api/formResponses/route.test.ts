// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { FormReviewService } from "@/lib/services/FormReviewService";
import {
  FormStatus,
  OrganizationConfigKey,
  SubmissionReviewStatus,
} from "@/lib/schema";
import {
  addMember,
  buildTestUser,
  createForm,
  createFormSubmission,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

async function setup(role = "admin", enabled = true) {
  const org = await createOrganization(`responses-${randomUUID()}`);
  const { user, session, headers } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, org.id, role);
  await setActiveOrganization(session.id, org.id);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.FormsEnabled,
    String(enabled),
  );
  const form = await createForm(org.id, { status: FormStatus.Published });
  const submissionId = await createFormSubmission(form);
  return { org, user, headers, form, submissionId };
}

function setStatus(
  submissionId: string,
  status: string,
  headers: Record<string, string>,
) {
  return testApi.formResponses[":submissionId"].status.$patch(
    { param: { submissionId }, json: { status: status as never } },
    { headers },
  );
}

describe("PATCH /api/formResponses/:submissionId/status", () => {
  it("lets an admin change a submission's status", async () => {
    const { headers, submissionId } = await setup();

    const res = await setStatus(
      submissionId,
      SubmissionReviewStatus.UnderReview,
      headers,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: submissionId,
      reviewStatus: SubmissionReviewStatus.UnderReview,
    });
  });

  it("rejects members", async () => {
    const { headers, submissionId } = await setup("member");
    expect(
      (await setStatus(submissionId, SubmissionReviewStatus.Accepted, headers))
        .status,
    ).toBe(403);
  });

  it("rejects signed-out requests", async () => {
    const { submissionId } = await setup();
    expect(
      (await setStatus(submissionId, SubmissionReviewStatus.Accepted, {}))
        .status,
    ).toBe(401);
  });

  it("is not found while forms are off", async () => {
    const { headers, submissionId } = await setup("admin", false);
    expect(
      (await setStatus(submissionId, SubmissionReviewStatus.Accepted, headers))
        .status,
    ).toBe(404);
  });

  it("rejects an unknown status", async () => {
    const { headers, submissionId } = await setup();
    expect((await setStatus(submissionId, "approved", headers)).status).toBe(
      400,
    );
  });

  it("can't change another organization's submission", async () => {
    const orgA = await setup();
    const orgB = await setup();

    const res = await setStatus(
      orgA.submissionId,
      SubmissionReviewStatus.Accepted,
      orgB.headers,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Submission not found" });
  });
});

describe("response list, bulk status, and preview API", () => {
  it("lists with totals and supports status/search/pagination", async () => {
    const { form, headers, user } = await setup();
    await createFormSubmission(form, { userId: user.id });
    const res = await testApi.formResponses[":formId"].$get(
      {
        param: { formId: form.formId },
        query: {
          status: SubmissionReviewStatus.Pending,
          search: user.email,
          limit: "1",
          offset: "0",
        },
      },
      { headers },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      total: 1,
      counts: { pending: 1 },
      rows: [expect.objectContaining({ email: user.email, updatedAt: null })],
    });
  });

  it.each([
    { role: "member", enabled: true, expected: 403 },
    { role: "admin", enabled: false, expected: 404 },
  ])(
    "guards every endpoint for $role with forms enabled=$enabled",
    async ({ role, enabled, expected }) => {
      const { form, submissionId, headers } = await setup(role, enabled);
      const json = {
        submissionIds: [submissionId],
        status: SubmissionReviewStatus.Accepted,
      };
      const list = await testApi.formResponses[":formId"].$get(
        { param: { formId: form.formId }, query: {} },
        { headers },
      );
      const bulk = await testApi.formResponses.status.$patch(
        { json },
        { headers },
      );
      const preview = await testApi.formResponses.status.preview.$post(
        { json },
        { headers },
      );
      expect([list.status, bulk.status, preview.status]).toEqual([
        expected,
        expected,
        expected,
      ]);
    },
  );

  it("requires authentication on the new endpoints", async () => {
    const { form, submissionId } = await setup();
    const json = {
      submissionIds: [submissionId],
      status: SubmissionReviewStatus.Pending,
    };
    expect(
      (
        await testApi.formResponses[":formId"].$get({
          param: { formId: form.formId },
          query: {},
        })
      ).status,
    ).toBe(401);
    expect((await testApi.formResponses.status.$patch({ json })).status).toBe(
      401,
    );
    expect(
      (await testApi.formResponses.status.preview.$post({ json })).status,
    ).toBe(401);
  });

  it("previews without writing and bulk changes up to 100 responses", async () => {
    const { org, form, headers, submissionId } = await setup();
    const ids = [submissionId];
    for (let index = 1; index < 100; index++)
      ids.push(await createFormSubmission(form));
    const json = {
      submissionIds: ids,
      status: SubmissionReviewStatus.Rejected,
    };
    const preview = await testApi.formResponses.status.preview.$post(
      { json },
      { headers },
    );
    expect(preview.status).toBe(200);
    expect(await preview.json()).toEqual({
      changed: 100,
      notified: 0,
      memberTypesChanged: 0,
    });
    expect(
      (
        await FormReviewService.listResponses(org.id, form.formId, {
          status: SubmissionReviewStatus.Pending,
          limit: 1,
          offset: 0,
        })
      ).total,
    ).toBe(100);
    const bulk = await testApi.formResponses.status.$patch(
      { json },
      { headers },
    );
    expect(bulk.status).toBe(200);
    expect(await bulk.json()).toHaveLength(100);
  });

  it.each([
    { submissionIds: [] },
    { submissionIds: Array.from({ length: 101 }, () => randomUUID()) },
    { submissionIds: ["invalid-id"] },
  ])("rejects invalid bulk ID arrays (%j)", async ({ submissionIds }) => {
    const { headers } = await setup();
    const json = { submissionIds, status: SubmissionReviewStatus.Accepted };
    expect(
      (await testApi.formResponses.status.$patch({ json }, { headers })).status,
    ).toBe(400);
    expect(
      (await testApi.formResponses.status.preview.$post({ json }, { headers }))
        .status,
    ).toBe(400);
  });

  it.each([
    { limit: "101" },
    { limit: "0" },
    { offset: "-1" },
    { offset: "1.5" },
    { status: "approved" },
    { search: "a".repeat(201) },
  ])("validates list query %j", async (query) => {
    const { form, headers } = await setup();
    const res = await testApi.formResponses[":formId"].$get(
      { param: { formId: form.formId }, query: query as never },
      { headers },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for missing forms and mixed-tenant bulk IDs without partial writes", async () => {
    const a = await setup();
    const b = await setup();
    for (const formId of [a.form.formId, "missing-form"]) {
      expect(
        (
          await testApi.formResponses[":formId"].$get(
            { param: { formId }, query: {} },
            { headers: b.headers },
          )
        ).status,
      ).toBe(404);
    }
    for (const foreignId of [a.submissionId, randomUUID()]) {
      const json = {
        submissionIds: [b.submissionId, foreignId],
        status: SubmissionReviewStatus.Accepted,
      };
      expect(
        (
          await testApi.formResponses.status.preview.$post(
            { json },
            { headers: b.headers },
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await testApi.formResponses.status.$patch(
            { json },
            { headers: b.headers },
          )
        ).status,
      ).toBe(404);
    }
    const remaining = await FormReviewService.listResponses(
      b.org.id,
      b.form.formId,
      { limit: 25, offset: 0 },
    );
    expect(remaining.rows[0].reviewStatus).toBe(SubmissionReviewStatus.Pending);
  });
});
