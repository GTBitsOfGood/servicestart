// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FormDraftService } from "@/features/forms/services/FormDraftService";
import {
  buildTestUser,
  createForm,
  createOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

async function createUser(organizationSlug: string) {
  const { user } = await signUpAndGetSession(buildTestUser(), organizationSlug);
  return user.id;
}

describe("FormDraftService", () => {
  it("saves and gets a member's draft", async () => {
    const organization = await createOrganization("draft-service");
    const userId = await createUser(organization.slug);
    const form = await createForm(organization.id);
    const answers = { [form.components[0].id]: "Ada" };

    const saved = await FormDraftService.save({
      organizationId: organization.id,
      formId: form.formId,
      userId,
      answers,
    });

    expect(saved).toEqual({
      id: expect.any(String),
      answers,
      updatedAt: expect.any(Date),
    });
    await expect(
      FormDraftService.get(organization.id, form.formId, userId),
    ).resolves.toEqual(saved);
  });

  it("overwrites an existing draft instead of creating another one", async () => {
    const organization = await createOrganization("draft-upsert");
    const userId = await createUser(organization.slug);
    const form = await createForm(organization.id);
    const first = await FormDraftService.save({
      organizationId: organization.id,
      formId: form.formId,
      userId,
      answers: { [form.components[0].id]: "First answer" },
    });
    const replacement = { [form.components[1].id]: "Replacement answer" };

    const updated = await FormDraftService.save({
      organizationId: organization.id,
      formId: form.formId,
      userId,
      answers: replacement,
    });

    expect(updated).toMatchObject({ id: first?.id, answers: replacement });
    await expect(
      FormDraftService.get(organization.id, form.formId, userId),
    ).resolves.toEqual(updated);
  });

  it("deletes only the requested member's draft", async () => {
    const organization = await createOrganization("draft-delete");
    const firstUserId = await createUser(organization.slug);
    const secondUserId = await createUser(organization.slug);
    const form = await createForm(organization.id);
    const answers = { [form.components[0].id]: "Saved answer" };
    await FormDraftService.save({
      organizationId: organization.id,
      formId: form.formId,
      userId: firstUserId,
      answers,
    });
    const secondDraft = await FormDraftService.save({
      organizationId: organization.id,
      formId: form.formId,
      userId: secondUserId,
      answers,
    });

    await expect(
      FormDraftService.delete(organization.id, form.formId, firstUserId),
    ).resolves.toBe(true);
    await expect(
      FormDraftService.get(organization.id, form.formId, firstUserId),
    ).resolves.toBeNull();
    await expect(
      FormDraftService.get(organization.id, form.formId, secondUserId),
    ).resolves.toEqual(secondDraft);
  });

  it("keeps drafts isolated when organizations use the same form ID", async () => {
    const organizationA = await createOrganization("draft-org-a");
    const organizationB = await createOrganization("draft-org-b");
    const userId = await createUser(organizationA.slug);
    const formId = "medical-history";
    const formA = await createForm(organizationA.id, { formId });
    const formB = await createForm(organizationB.id, { formId });
    const answersA = { [formA.components[0].id]: "Organization A" };
    const answersB = { [formB.components[0].id]: "Organization B" };
    await FormDraftService.save({
      organizationId: organizationA.id,
      formId,
      userId,
      answers: answersA,
    });
    await FormDraftService.save({
      organizationId: organizationB.id,
      formId,
      userId,
      answers: answersB,
    });

    await expect(
      FormDraftService.get(organizationA.id, formId, userId),
    ).resolves.toMatchObject({ answers: answersA });
    await expect(
      FormDraftService.get(organizationB.id, formId, userId),
    ).resolves.toMatchObject({ answers: answersB });

    await FormDraftService.delete(organizationA.id, formId, userId);
    await expect(
      FormDraftService.get(organizationA.id, formId, userId),
    ).resolves.toBeNull();
    await expect(
      FormDraftService.get(organizationB.id, formId, userId),
    ).resolves.toMatchObject({ answers: answersB });
  });

  it("returns missing results instead of using a form from another org", async () => {
    const organizationA = await createOrganization("draft-missing-a");
    const organizationB = await createOrganization("draft-missing-b");
    const userId = await createUser(organizationA.slug);
    const form = await createForm(organizationA.id, {
      formId: "private-form",
    });

    await expect(
      FormDraftService.save({
        organizationId: organizationB.id,
        formId: form.formId,
        userId,
        answers: {},
      }),
    ).resolves.toBeNull();
    await expect(
      FormDraftService.get(organizationB.id, form.formId, userId),
    ).resolves.toBeNull();
    await expect(
      FormDraftService.delete(organizationB.id, form.formId, userId),
    ).resolves.toBe(false);
  });
});
