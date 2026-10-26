// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { InformationRequestService } from "@/lib/services/InformationRequestService";
import { NotificationService } from "@/lib/services/NotificationService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import {
  FormStatus,
  MemberType,
  NotificationType,
  OrganizationConfigKey,
} from "@/lib/schema";
import {
  addMember,
  buildTestUser,
  createForm,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

async function setup(role = "admin", enabled = true) {
  const org = await createOrganization(`info-requests-${randomUUID()}`);
  const { user, session, headers } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, org.id, role);
  await setActiveOrganization(session.id, org.id);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.FormsEnabled,
    String(enabled),
  );
  const { user: member } = await signUpAndGetSession(buildTestUser());
  await addMember(member.id, org.id, "member", MemberType.Attendee);
  const form = await createForm(org.id, {
    title: "Medical History",
    status: FormStatus.Published,
  });
  return { org, user, headers, member, form };
}

function sendRequest(
  json: { userId: string; formId: string; message?: string },
  headers: Record<string, string>,
) {
  return testApi.informationRequests.$post({ json }, { headers });
}

function listNotifications(userId: string, organizationId: string) {
  return NotificationService.listByUserAndOrganization(
    userId,
    organizationId,
    "all",
    undefined,
    { limit: 10, offset: 0 },
  );
}

describe("POST /api/informationRequests", () => {
  it("sends the member a notification linking to the form", async () => {
    const { org, headers, member, form } = await setup();

    const res = await sendRequest(
      {
        userId: member.id,
        formId: form.formId,
        message: "  We need this before camp.  ",
      },
      headers,
    );

    expect(res.status).toBe(201);
    const [notification] = await listNotifications(member.id, org.id);
    expect(notification).toMatchObject({
      type: NotificationType.ActionRequired,
      text: "Please complete Medical History\n\nWe need this before camp.",
      metadata: { link: `/forms/${form.formId}` },
    });
  });

  it("leaves the message out when there isn't one", async () => {
    const { org, headers, member, form } = await setup();

    await sendRequest({ userId: member.id, formId: form.formId }, headers);

    const [notification] = await listNotifications(member.id, org.id);
    expect(notification.text).toBe("Please complete Medical History");
  });

  it("rejects a repeat request within 24 hours", async () => {
    const { org, headers, member, form } = await setup();

    await sendRequest({ userId: member.id, formId: form.formId }, headers);
    const res = await sendRequest(
      { userId: member.id, formId: form.formId },
      headers,
    );

    expect(res.status).toBe(409);
    expect(await listNotifications(member.id, org.id)).toHaveLength(1);
  });

  it("allows another request once 24 hours have passed", async () => {
    const { org, user, headers, member, form } = await setup();
    await InformationRequestService.request({
      organizationId: org.id,
      userId: member.id,
      formId: form.formId,
      requestedBy: user.id,
      now: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    const res = await sendRequest(
      { userId: member.id, formId: form.formId },
      headers,
    );

    expect(res.status).toBe(201);
  });

  it("allows a request for a different form", async () => {
    const { org, headers, member, form } = await setup();
    const other = await createForm(org.id, { status: FormStatus.Published });

    await sendRequest({ userId: member.id, formId: form.formId }, headers);
    const res = await sendRequest(
      { userId: member.id, formId: other.formId },
      headers,
    );

    expect(res.status).toBe(201);
  });

  it("is not found for a user who isn't a member", async () => {
    const { headers, form } = await setup();
    const { user: outsider } = await signUpAndGetSession(buildTestUser());

    const res = await sendRequest(
      { userId: outsider.id, formId: form.formId },
      headers,
    );

    expect(res.status).toBe(404);
  });

  it("is not found for a form that isn't published", async () => {
    const { org, headers, member } = await setup();
    const draft = await createForm(org.id, { status: FormStatus.Draft });
    const closed = await createForm(org.id, { status: FormStatus.Closed });

    for (const form of [draft, closed]) {
      const res = await sendRequest(
        { userId: member.id, formId: form.formId },
        headers,
      );
      expect(res.status).toBe(404);
    }
  });

  it("rejects members", async () => {
    const { headers, member, form } = await setup("member");
    expect(
      (await sendRequest({ userId: member.id, formId: form.formId }, headers))
        .status,
    ).toBe(403);
  });

  it("rejects signed-out requests", async () => {
    const { member, form } = await setup();
    expect(
      (await sendRequest({ userId: member.id, formId: form.formId }, {}))
        .status,
    ).toBe(401);
  });

  it("is not found while forms are off", async () => {
    const { headers, member, form } = await setup("admin", false);
    expect(
      (await sendRequest({ userId: member.id, formId: form.formId }, headers))
        .status,
    ).toBe(404);
  });

  it("can't ask another organization's member or use its form", async () => {
    const orgA = await setup();
    const orgB = await setup();

    const foreignMember = await sendRequest(
      { userId: orgA.member.id, formId: orgB.form.formId },
      orgB.headers,
    );
    const foreignForm = await sendRequest(
      { userId: orgB.member.id, formId: orgA.form.formId },
      orgB.headers,
    );

    expect(foreignMember.status).toBe(404);
    expect(foreignForm.status).toBe(404);
    expect(await listNotifications(orgA.member.id, orgA.org.id)).toEqual([]);
    expect(await listNotifications(orgA.member.id, orgB.org.id)).toEqual([]);
  });
});
