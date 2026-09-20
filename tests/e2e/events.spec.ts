import { test, expect, type Page } from "@playwright/test";
import {
  createTestAdminAndSignIn,
  createTestMemberAndSignIn,
} from "./testUtils";

/** A date well in the future, so the event never falls into the past. */
function futureDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

async function fillPublishableDetails(page: Page) {
  await page.locator('input[name="date"]').fill(futureDate());
  await page.locator('input[name="start"]').fill("14:00");
  await page.locator('input[name="end"]').fill("16:00");
  await page
    .locator('textarea[name="description"]')
    .fill("Bring a dish to share.");
  await page.locator('input[name="address"]').fill("123 Peachtree St");
  await page.locator('input[name="city"]').fill("Atlanta");
  await page.locator('input[name="state"]').fill("GA");
  await page.locator('input[name="zip"]').fill("30308");
}

test.describe("Event lifecycle", () => {
  test("draft, edit, publish, register, update, unpublish", async ({
    page,
    browser,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);
    const eventName = `Community Picnic ${Date.now()}`;

    // The admin saves a draft that only has a title.
    await page.goto("/events/create");
    await page.locator('input[name="title"]').fill(eventName);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();

    await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
    const eventUrl = new URL(page.url()).pathname;

    // A member cannot find the draft in the list or reach it directly.
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await createTestMemberAndSignIn(memberPage, { organizationId: org.id });

    await memberPage.goto("/events");
    await expect(memberPage.getByText(eventName)).toHaveCount(0);

    await memberPage.goto(eventUrl);
    await expect(memberPage).not.toHaveURL(eventUrl);

    // The admin fills in the rest and publishes.
    await page.goto(`${eventUrl}/edit`);
    await fillPublishableDetails(page);
    await page.getByRole("button", { name: "Publish", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`${eventUrl}$`));
    await expect(page.getByText("Draft", { exact: true })).toHaveCount(0);

    // The member now discovers the event and registers for it.
    await memberPage.goto("/events");
    await expect(memberPage.getByText(eventName).first()).toBeVisible();

    await memberPage.goto(eventUrl);
    await memberPage
      .getByRole("button", { name: "Register", exact: true })
      .click();
    await expect(
      memberPage.getByRole("button", { name: "Unregister", exact: true }),
    ).toBeVisible();

    // An admin edit shows up for the member.
    const updatedName = `${eventName} (updated)`;
    await page.goto(`${eventUrl}/edit`);
    await page.locator('input[name="title"]').fill(updatedName);
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${eventUrl}$`));

    await memberPage.goto(eventUrl);
    await expect(
      memberPage.getByRole("heading", { name: updatedName }),
    ).toBeVisible();

    // Unpublishing hides the event from the member again.
    await page.goto(eventUrl);
    await page.getByRole("button", { name: "Unpublish", exact: true }).click();
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();

    await memberPage.goto("/events");
    await expect(memberPage.getByText(updatedName)).toHaveCount(0);

    await memberContext.close();
  });

  test("an admin deletes an event after confirming", async ({ page }) => {
    await createTestAdminAndSignIn(page);
    const eventName = `Cleanup Day ${Date.now()}`;

    await page.goto("/events/create");
    await page.locator('input[name="title"]').fill(eventName);
    await fillPublishableDetails(page);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete event" }).click();

    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByText(eventName)).toHaveCount(0);
  });

  test("publishing is refused until the required details are filled in", async ({
    page,
  }) => {
    await createTestAdminAndSignIn(page);

    await page.goto("/events/create");
    await page.locator('input[name="title"]').fill("Half-finished idea");
    await page.getByRole("button", { name: "Publish", exact: true }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: /required fields/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/events\/create$/);
  });

  test("members cannot open the event creation or edit pages", async ({
    page,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);
    const eventName = `Members Cannot Edit ${Date.now()}`;

    await page.goto("/events/create");
    await page.locator('input[name="title"]').fill(eventName);
    await fillPublishableDetails(page);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);
    const eventUrl = new URL(page.url()).pathname;

    await page.context().clearCookies();
    await createTestMemberAndSignIn(page, { organizationId: org.id });

    await page.goto(`${eventUrl}/edit`);
    await expect(page).not.toHaveURL(new RegExp(`${eventUrl}/edit$`));

    await page.goto("/events/create");
    await expect(page).not.toHaveURL(/\/events\/create$/);
  });
});
