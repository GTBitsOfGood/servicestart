// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
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
  return { org, user, headers, submissionId };
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
