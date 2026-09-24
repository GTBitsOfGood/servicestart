import { expect, test, type Page, type Route } from "@playwright/test";
import { MembersService } from "@/lib/services/MemberService";
import {
  addMember,
  buildTestUser,
  createOrganization,
  signUpAndGetSession,
} from "../unit/testUtils";
import {
  createTestAdminAndSignIn,
  createTestMemberAndSignIn,
  createTestUserWithPendingJoinRequestAndSignIn,
} from "./testUtils";

const EMAIL_SENT_MESSAGE = "Email sent.";
const FAILURE_MESSAGE = "Mail service unavailable";
const RETRY_BEAT_MS = 3000;

async function hold(page: Page, ms = 2000) {
  await page.waitForTimeout(ms);
}

async function openComposer(page: Page) {
  await page.goto("/inbox");
  await page.getByRole("button", { name: "New +" }).click();
  await expect(page.getByPlaceholder("Message Headline")).toBeVisible();
}

async function fillComposer(page: Page, recipientName: string) {
  await page.getByRole("button", { name: "Add recipient" }).click();
  await page.getByRole("option", { name: recipientName }).click();
  await page.getByPlaceholder("Message Headline").fill("Board update");
  await page.getByPlaceholder("Message Text").fill("Thanks for volunteering.");
}

function fulfillEmail(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.describe("Inbox email", () => {
  test("hides New from members who are not admins", async ({ page }) => {
    await createTestMemberAndSignIn(page);
    await page.goto("/inbox");
    await expect(
      page.getByRole("heading", { name: "Notifications" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "New +" })).toHaveCount(0);
    await hold(page);
  });

  test("sends a guest to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/inbox");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "New +" })).toHaveCount(0);
    await hold(page);
  });

  test("sends a pending join request away from the inbox", async ({ page }) => {
    await createTestUserWithPendingJoinRequestAndSignIn(page);
    await page.goto("/inbox");
    await expect(page).toHaveURL(/\/joinrequeststatus/);
    await expect(page.getByRole("button", { name: "New +" })).toHaveCount(0);
    await hold(page);
  });

  test("lets an owner open the composer", async ({ page }) => {
    await createTestAdminAndSignIn(page, { role: "owner" });
    await openComposer(page);
    await hold(page);
  });

  test("lists teammates and hides members of another organization", async ({
    page,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);
    const teammate = buildTestUser();
    const { session: teammateSession } = await signUpAndGetSession(teammate);
    await addMember(teammateSession.userId, org.id, "member");

    const otherOrg = await createOrganization(
      `e2e-other-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    );
    const outsider = buildTestUser();
    const { session: outsiderSession } = await signUpAndGetSession(outsider);
    await addMember(outsiderSession.userId, otherOrg.id, "member");

    await openComposer(page);
    await page.getByRole("button", { name: "Add recipient" }).click();
    await expect(
      page.getByRole("option", { name: teammate.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: outsider.name, exact: true }),
    ).toHaveCount(0);
    await hold(page);
  });

  test("admin sends an email and sees success only after the request succeeds", async ({
    page,
  }) => {
    const { user } = await createTestAdminAndSignIn(page);
    let releaseSend: (() => void) | undefined;
    const sendStarted = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    const requestBodies: Array<{ recipientIds: string[]; subject: string }> =
      [];

    await page.route("**/api/emails", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      requestBodies.push(route.request().postDataJSON());
      await sendStarted;
      await fulfillEmail(route, 200, { success: true });
    });

    await openComposer(page);
    await page.getByRole("button", { name: "Send Email" }).click();
    await expect(
      page.getByText("Select at least one recipient."),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Message Headline")).toBeVisible();

    await fillComposer(page, user.name);
    await page.getByRole("button", { name: "Send Email" }).click();
    await expect(
      page.getByRole("button", { name: "Sending..." }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Message Headline")).toBeVisible();
    await expect.poll(() => requestBodies.length).toBe(1);

    releaseSend?.();
    await expect(page.getByText(EMAIL_SENT_MESSAGE)).toBeVisible();
    await expect(page.getByPlaceholder("Message Headline")).toHaveCount(0);
    expect(requestBodies[0].subject).toBe("Board update");
    expect(requestBodies[0].recipientIds.length).toBeGreaterThan(0);
    await page.getByRole("button", { name: "New +" }).click();
    await expect(page.getByPlaceholder("Message Headline")).toHaveValue("");
    await expect(page.getByPlaceholder("Message Text")).toHaveValue("");
  });

  test("keeps the draft when sending fails and allows a retry", async ({
    page,
  }) => {
    const { user } = await createTestAdminAndSignIn(page);
    let attempts = 0;

    await page.route("**/api/emails", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      attempts += 1;
      if (attempts === 1) {
        await fulfillEmail(route, 500, { error: FAILURE_MESSAGE });
        return;
      }
      await fulfillEmail(route, 200, { success: true });
    });

    await openComposer(page);
    await fillComposer(page, user.name);
    await page.getByRole("button", { name: "Send Email" }).click();

    await expect(page.getByText(FAILURE_MESSAGE)).toBeVisible();
    await expect(page.getByPlaceholder("Message Headline")).toHaveValue(
      "Board update",
    );
    await expect(page.getByPlaceholder("Message Text")).toHaveValue(
      "Thanks for volunteering.",
    );
    await expect(
      page.getByRole("dialog").getByText(user.name, { exact: true }),
    ).toBeVisible();
    await hold(page, RETRY_BEAT_MS);

    await page.getByRole("button", { name: "Send Email" }).click();
    await expect(page.getByText(EMAIL_SENT_MESSAGE)).toBeVisible();
    await expect(page.getByPlaceholder("Message Headline")).toHaveCount(0);
  });

  test("can select a recipient beyond the first 100 members", async ({
    page,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);
    for (let index = 0; index < 100; index += 1) {
      await MembersService.addMemberDirectly(
        `recipient-${index}-${org.id}@example.com`,
        `Recipient ${index}`,
        org.id,
      );
    }
    const [lastMember] = await MembersService.listMembers(org.id, {
      limit: 1,
      offset: 100,
    });
    await openComposer(page);
    await page.getByRole("button", { name: "Add recipient" }).click();
    await page
      .getByRole("option", { name: lastMember.name, exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByText(lastMember.name, { exact: true }),
    ).toBeVisible();
  });

  test("can retry loading recipients without losing the draft", async ({
    page,
  }) => {
    const { user } = await createTestAdminAndSignIn(page);
    let attempts = 0;
    await page.route("**/api/members?*", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({ status: 503, body: "Unavailable" });
      } else {
        await route.continue();
      }
    });
    await openComposer(page);
    await page.getByPlaceholder("Message Headline").fill("Draft to keep");
    await expect(page.getByRole("alert")).toContainText(
      "Unable to load recipients",
    );
    await hold(page, RETRY_BEAT_MS);
    await page.getByRole("button", { name: /retry/i }).click();
    await page.getByRole("button", { name: "Add recipient" }).click();
    await page.getByRole("option", { name: user.name }).click();
    await expect(page.getByPlaceholder("Message Headline")).toHaveValue(
      "Draft to keep",
    );
  });
});
