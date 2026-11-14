// @vitest-environment node
import { describe, expect, it } from "vitest";
import { app } from "@/features/app";
import { OrganizationConfigKey } from "@/core/config/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { FormComponentType, FormStatus } from "@/core/db/schema";
import { FormService } from "@/features/forms/services/FormService";
import {
  addMember,
  buildTestUser,
  createForm,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

const draftUrl = (formId: string) =>
  `http://localhost/api/forms/${formId}/draft`;

async function formsOrganization(enabled = true) {
  const organization = await createOrganization(
    `drafts-${Math.random().toString(36).slice(2, 10)}`,
  );
  await OrganizationConfigService.setConfig(
    organization.id,
    OrganizationConfigKey.FormsEnabled,
    String(enabled),
  );
  return organization;
}

async function signedInTo(
  organization: { id: string; slug: string },
  member = true,
) {
  const { user, session, headers } = await signUpAndGetSession(
    buildTestUser(),
    organization.slug,
  );
  if (member) await addMember(user.id, organization.id, "member");
  await setActiveOrganization(session.id, organization.id);
  return {
    user,
    headers: { ...headers, Host: `${organization.slug}.lvh.me` },
  };
}

function putDraft(
  formId: string,
  headers: Record<string, string>,
  answers: Record<string, unknown>,
) {
  return app.request(draftUrl(formId), {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}

describe("/api/forms/:formId/draft", () => {
  it("returns 401 when signed out", async () => {
    expect((await app.request(draftUrl("medical-history"))).status).toBe(401);
  });

  it.each(["GET", "PUT", "DELETE"])(
    "returns 404 for %s while forms are off",
    async (method) => {
      const organization = await formsOrganization(false);
      const { headers } = await signedInTo(organization);

      expect(
        (await app.request(draftUrl("medical-history"), { method, headers }))
          .status,
      ).toBe(404);
    },
  );

  it("returns 404 for a signed-in non-member", async () => {
    const organization = await formsOrganization();
    const { headers } = await signedInTo(organization, false);

    expect(
      (await app.request(draftUrl("medical-history"), { headers })).status,
    ).toBe(404);
  });

  it("saves, loads, overwrites, and deletes the member's draft", async () => {
    const organization = await formsOrganization();
    const { headers } = await signedInTo(organization);
    const form = await createForm(organization.id, {
      formId: "medical-history",
      status: FormStatus.Published,
    });
    const textQuestions = form.components.filter(
      ({ type }) => type === FormComponentType.ShortText,
    );
    const firstAnswers = { [textQuestions[0].id]: "Ada" };
    const firstResponse = await putDraft(form.formId, headers, firstAnswers);

    expect(firstResponse.status).toBe(200);
    const firstDraft = await firstResponse.json();
    expect(firstDraft).toEqual({
      id: expect.any(String),
      answers: firstAnswers,
      updatedAt: expect.any(String),
    });

    const loaded = await app.request(draftUrl(form.formId), { headers });
    expect(loaded.status).toBe(200);
    expect(await loaded.json()).toEqual(firstDraft);

    const replacement = { [textQuestions[1].id]: "Updated answer" };
    const overwrite = await putDraft(form.formId, headers, replacement);
    expect(overwrite.status).toBe(200);
    expect(await overwrite.json()).toMatchObject({
      id: firstDraft.id,
      answers: replacement,
    });

    const removed = await app.request(draftUrl(form.formId), {
      method: "DELETE",
      headers,
    });
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ success: true });
    expect((await app.request(draftUrl(form.formId), { headers })).status).toBe(
      404,
    );
  });

  it("allows incomplete answers but rejects a present answer's wrong type", async () => {
    const organization = await formsOrganization();
    const { headers } = await signedInTo(organization);
    const form = await createForm(organization.id, {
      status: FormStatus.Published,
    });
    const numberQuestion = form.components.find(
      ({ type }) => type === FormComponentType.Number,
    )!;

    expect((await putDraft(form.formId, headers, {})).status).toBe(200);

    const invalid = await putDraft(form.formId, headers, {
      [numberQuestion.id]: "9",
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: "Some answers couldn't be saved",
      fieldErrors: { [numberQuestion.id]: expect.any(String) },
    });
  });

  it("rejects unknown question IDs", async () => {
    const organization = await formsOrganization();
    const { headers } = await signedInTo(organization);
    const form = await createForm(organization.id, {
      status: FormStatus.Published,
    });

    const response = await putDraft(form.formId, headers, {
      "00000000-0000-4000-8000-0000000000ff": "extra",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      fieldErrors: { "": "Unknown question" },
    });
  });

  it("only saves drafts for published forms that are currently open", async () => {
    const organization = await formsOrganization();
    const { headers } = await signedInTo(organization);
    const unpublished = await createForm(organization.id, {
      status: FormStatus.Draft,
    });
    const notYetOpen = await createForm(organization.id, {
      status: FormStatus.Published,
      settings: { opensAt: "2999-01-01T00:00:00Z" },
    });
    const closed = await createForm(organization.id, {
      status: FormStatus.Closed,
    });

    expect((await putDraft(unpublished.formId, headers, {})).status).toBe(404);
    expect((await putDraft(notYetOpen.formId, headers, {})).status).toBe(403);
    expect((await putDraft(closed.formId, headers, {})).status).toBe(403);
  });

  it("keeps a draft readable and discardable after the form closes", async () => {
    const organization = await formsOrganization();
    const { headers } = await signedInTo(organization);
    const form = await createForm(organization.id, {
      status: FormStatus.Published,
    });
    expect((await putDraft(form.formId, headers, {})).status).toBe(200);
    await FormService.transition(organization.id, form.formId, "close");

    expect((await app.request(draftUrl(form.formId), { headers })).status).toBe(
      200,
    );
    expect(
      (
        await app.request(draftUrl(form.formId), {
          method: "DELETE",
          headers,
        })
      ).status,
    ).toBe(200);
  });

  it("never exposes one member's draft to another member", async () => {
    const organization = await formsOrganization();
    const first = await signedInTo(organization);
    const second = await signedInTo(organization);
    const form = await createForm(organization.id, {
      status: FormStatus.Published,
    });
    expect((await putDraft(form.formId, first.headers, {})).status).toBe(200);

    expect(
      (await app.request(draftUrl(form.formId), { headers: second.headers }))
        .status,
    ).toBe(404);
    expect(
      (
        await app.request(draftUrl(form.formId), {
          method: "DELETE",
          headers: second.headers,
        })
      ).status,
    ).toBe(404);
    expect(
      (await app.request(draftUrl(form.formId), { headers: first.headers }))
        .status,
    ).toBe(200);
  });

  it("returns 404 for a form ID from another organization", async () => {
    const organizationA = await formsOrganization();
    const organizationB = await formsOrganization();
    const { headers } = await signedInTo(organizationB);
    const formA = await createForm(organizationA.id, {
      formId: "other-org-form",
      status: FormStatus.Published,
    });

    expect((await putDraft(formA.formId, headers, {})).status).toBe(404);
    expect(
      (await app.request(draftUrl(formA.formId), { headers })).status,
    ).toBe(404);
  });

  it("rejects a tenant host that disagrees with the session's active organization", async () => {
    // #335: authenticated requests on a tenant host must match the session's
    // active organization, as the response routes do. The browser switches
    // its active organization to the host's, and autosave then retries.
    const hostOrganization = await formsOrganization();
    const activeOrganization = await formsOrganization();
    const { user, headers } = await signedInTo(activeOrganization);
    await addMember(user.id, hostOrganization.id, "member");

    const formId = "shared-medical-history";
    const hostForm = await createForm(hostOrganization.id, {
      formId,
      status: FormStatus.Published,
    });
    await createForm(activeOrganization.id, {
      formId,
      status: FormStatus.Published,
    });
    const answerId = hostForm.components.find(
      ({ type }) => type === FormComponentType.ShortText,
    )!.id;
    const hostHeaders = {
      ...headers,
      Host: `${hostOrganization.slug}.lvh.me`,
    };

    expect(
      (await putDraft(formId, hostHeaders, { [answerId]: "Host answer" }))
        .status,
    ).toBe(403);
    expect(
      (await app.request(draftUrl(formId), { headers: hostHeaders })).status,
    ).toBe(403);
    // Nothing was saved in the active organization either.
    expect((await app.request(draftUrl(formId), { headers })).status).toBe(404);
  });
});
