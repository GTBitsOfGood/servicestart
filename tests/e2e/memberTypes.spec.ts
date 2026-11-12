import { test, expect } from "@playwright/test";
import { OrganizationConfigKey } from "@/core/config/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  addMember,
  buildTestUser,
  signUpAndGetSession,
} from "../unit/testUtils";
import { createTestAdminAndSignIn } from "./testUtils";

test("admin manages member types", async ({ page }) => {
  const { org } = await createTestAdminAndSignIn(page);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.MemberTypesEnabled,
    "true",
  );

  await page.goto("/settings/member-types");
  await page.waitForLoadState("load");
  await expect(
    page.getByRole("heading", { name: "Member types" }),
  ).toBeVisible();
  await expect(page.getByText("Key: applicant")).toBeVisible();

  await page.getByRole("button", { name: "Add member type" }).click();
  const addDialog = page.getByRole("dialog");
  await addDialog.getByLabel("Label", { exact: true }).fill("Volunteer");
  await addDialog
    .getByLabel("Plural label", { exact: true })
    .fill("Volunteers");
  await addDialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(addDialog).not.toBeVisible();
  await expect(page.getByText("Key: volunteer")).toBeVisible();

  const volunteerLabel = page.locator("#type-volunteer-label");
  await volunteerLabel.fill("Helper");
  await volunteerLabel.blur();
  await expect(volunteerLabel).toHaveValue("Helper");

  await page.getByRole("button", { name: "Move member type 3 up" }).click();
  await page.getByRole("button", { name: "Move member type 2 up" }).click();
  await page.reload();
  const labelsAfterMove = await page
    .locator('label:has-text("Label") input')
    .evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
  expect(labelsAfterMove[0]).toBe("Helper");

  const signupDefault = page.getByLabel("Signup default for Helper");
  const defaultSave = page.waitForResponse(
    (response) =>
      response.url().includes("/api/memberTypes/signupDefault") &&
      response.request().method() === "PUT" &&
      response.ok(),
  );
  await signupDefault.check();
  await defaultSave;
  await page.reload();
  await expect(signupDefault).toBeChecked();

  const attendeeLabel = "Current Attendee";
  for (let index = 0; index < 2; index += 1) {
    const extra = buildTestUser();
    const { user: extraUser } = await signUpAndGetSession(extra);
    await addMember(extraUser.id, org.id, "member", "attendee");
  }

  await page
    .getByRole("button", { name: `Delete member type ${attendeeLabel}` })
    .click();
  const deleteDialog = page.getByRole("dialog");
  await deleteDialog
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(deleteDialog.getByRole("alert")).toContainText(
    `2 members and 0 forms use ${attendeeLabel}.`,
  );
  await expect(page.getByText(`Key: ${"attendee"}`)).toBeVisible();
});
