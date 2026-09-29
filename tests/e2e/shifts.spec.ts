import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "../unit/testUtils";
import { ensureServicestartOrganization } from "./testUtils";

async function signIn(
  page: Page,
  organizationId: string,
  role: string,
  baseURL: string,
) {
  const { user, session, headers } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, organizationId, role);
  await setActiveOrganization(session.id, organizationId);
  const [name, ...value] = headers.Cookie.split(";")[0].split("=");
  await page.context().addCookies([
    {
      name,
      value: value.join("="),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return user;
}

// These are real same-origin browser requests, equivalent to the DevTools smoke
// flow. Shifts do not yet have a UI; the parent event uses its actual UI below.
async function request(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(`/api${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    },
    { method, path, body },
  );
}

test("shift smoke flow through the event UI and authenticated browser sessions", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  await ensureServicestartOrganization();
  const org = await createOrganization(`shift-browser-${randomUUID()}`);
  const admin = await signIn(page, org.id, "admin", baseURL!);
  const memberContext = await browser.newContext({ baseURL });
  const otherContext = await browser.newContext({ baseURL });
  const memberPage = await memberContext.newPage();
  const otherPage = await otherContext.newPage();
  const member = await signIn(memberPage, org.id, "member", baseURL!);
  const otherOrg = await createOrganization(`shift-other-${randomUUID()}`);
  await signIn(otherPage, otherOrg.id, "admin", baseURL!);

  try {
    const title = `Shift browser smoke ${Date.now()}`;
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    const startTimestamp = date.toISOString();
    await test.step("Publish a disposable event through the UI", async () => {
      await page.goto("/events/create");
      await page.waitForLoadState("networkidle");
      await page.locator('input[name="title"]').fill(title);
      await page
        .locator('input[name="date"]')
        .fill(startTimestamp.slice(0, 10));
      await page.locator('input[name="start"]').fill("14:00");
      await page.locator('input[name="end"]').fill("16:00");
      await page
        .locator('textarea[name="description"]')
        .fill("Disposable shift validation event.");
      await page.locator('input[name="address"]').fill("123 Peachtree St");
      await page.locator('input[name="city"]').fill("Atlanta");
      await page.locator('input[name="state"]').fill("GA");
      await page.locator('input[name="zip"]').fill("30308");
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/, {
        timeout: 30_000,
      });
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("published-event.png"),
        fullPage: true,
      });
    });
    const eventPath = new URL(page.url()).pathname;
    const eventId = eventPath.split("/").at(-1)!;
    await memberPage.goto(eventPath);
    await expect(
      memberPage.getByRole("heading", { name: title }),
    ).toBeVisible();
    await otherPage.goto("/events");
    const data = {
      eventId,
      name: "Browser test shift",
      startTimestamp,
      duration: "1 hour",
      rsvpLimit: 1,
    };
    const created = await request(page, "POST", "/shifts", data);
    expect(created.status).toBe(200);
    const path = `/shifts/${created.body.shift.id}`;
    const rsvps = `${path}/rsvps`;

    await test.step("Signup, retry, full capacity, withdrawal and multiple shifts", async () => {
      expect((await request(page, "GET", path)).status).toBe(200);
      expect((await request(page, "POST", rsvps)).status).toBe(200);
      expect((await request(page, "POST", rsvps)).status).toBe(200);
      expect(await request(memberPage, "POST", rsvps)).toMatchObject({
        status: 409,
        body: { reason: "full" },
      });
      expect((await request(page, "DELETE", rsvps)).status).toBe(200);
      expect((await request(page, "DELETE", rsvps)).status).toBe(200);
      expect((await request(memberPage, "POST", rsvps)).status).toBe(200);
      const second = await request(page, "POST", "/shifts", {
        ...data,
        name: "Second shift",
      });
      expect(second.status).toBe(200);
      expect(
        (
          await request(
            memberPage,
            "POST",
            `/shifts/${second.body.shift.id}/rsvps`,
          )
        ).status,
      ).toBe(200);
    });

    await test.step("Actor authorization and invalid capacities/durations", async () => {
      expect(
        (await request(memberPage, "DELETE", `${rsvps}?userId=${admin.id}`))
          .status,
      ).toBe(403);
      expect(
        (await request(memberPage, "POST", `${rsvps}?userId=${admin.id}`))
          .status,
      ).toBe(403);
      expect(
        (await request(page, "DELETE", `${rsvps}?userId=${member.id}`)).status,
      ).toBe(200);
      expect(
        (await request(page, "POST", `${rsvps}?userId=${member.id}`)).status,
      ).toBe(200);
      for (const rsvpLimit of [0, -1, 1.5]) {
        expect((await request(page, "PATCH", path, { rsvpLimit })).status).toBe(
          400,
        );
      }
      expect(
        (await request(page, "PATCH", path, { duration: "garbage" })).status,
      ).toBe(400);
      expect(
        (await request(page, "PATCH", path, { rsvpLimit: null })).status,
      ).toBe(200);
      expect((await request(page, "POST", rsvps)).status).toBe(200);
    });

    await test.step("An admin in another organization cannot access or mutate the shift", async () => {
      for (const method of ["GET", "PATCH", "DELETE"]) {
        expect(
          (
            await request(
              otherPage,
              method,
              path,
              method === "PATCH" ? { name: "Unauthorized change" } : undefined,
            )
          ).status,
        ).toBe(404);
      }
      expect((await request(otherPage, "POST", rsvps)).status).toBe(404);
      expect(
        (await request(otherPage, "DELETE", `${rsvps}?userId=${member.id}`))
          .status,
      ).toBe(404);
      expect(
        (await request(otherPage, "GET", `/events/${eventId}/shifts`)).status,
      ).toBe(404);
      expect((await request(page, "GET", path)).body.shift.name).toBe(
        data.name,
      );
    });

    await test.step("Unpublish in the UI; members lose access and admins cannot sign up", async () => {
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page
        .getByRole("button", { name: "Unpublish", exact: true })
        .click();
      await expect(page.getByText("Draft", { exact: true })).toBeVisible();
      expect((await request(memberPage, "GET", path)).status).toBe(404);
      expect((await request(memberPage, "POST", rsvps)).status).toBe(404);
      expect((await request(page, "GET", path)).status).toBe(200);
      expect(await request(page, "POST", rsvps)).toMatchObject({
        status: 400,
        body: { reason: "unpublished" },
      });
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await expect(page.getByText("Draft", { exact: true })).toHaveCount(0);
    });

    await test.step("Parent deadline closes signup and withdrawal", async () => {
      expect((await request(page, "DELETE", rsvps)).status).toBe(200);
      expect(
        (
          await request(page, "PATCH", `/events/${eventId}`, {
            rsvpDeadline: new Date(Date.now() - 60_000).toISOString(),
          })
        ).status,
      ).toBe(200);
      expect(await request(page, "POST", rsvps)).toMatchObject({
        status: 400,
        body: { reason: "deadline-passed" },
      });
      expect(await request(memberPage, "DELETE", rsvps)).toMatchObject({
        status: 400,
        body: { reason: "deadline-passed" },
      });
    });

    await test.step("Delete the test event through the UI and verify its shifts disappear", async () => {
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page
        .getByRole("button", { name: "Delete event", exact: true })
        .click();
      await expect(page).toHaveURL(/\/events$/);
      expect((await request(page, "GET", path)).status).toBe(404);
    });
  } finally {
    await memberContext.close();
    await otherContext.close();
  }
});
