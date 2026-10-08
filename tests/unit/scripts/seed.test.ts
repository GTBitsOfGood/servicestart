// @vitest-environment node

import { auth } from "@/lib/auth";
import db from "@/lib/db";
import {
  organizations,
  users,
  accounts,
  members,
  organizationConfig,
  OrganizationConfigKey,
  forms,
  formComponents,
  FormStatus,
  MemberType,
  notifications,
  joinRequests,
  joinRequestHistory,
  JoinRequestStatus,
} from "@/lib/schema";
import { FormDefinitionSchema } from "@/lib/forms/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { hashPassword } from "better-auth/crypto";
import { main } from "@/scripts/seed";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import { MembersService } from "@/lib/services/MemberService";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  createForm,
  DEFAULT_TEST_PASSWORD,
  VISIONARIES_APPLICATION_FORM,
} from "../testUtils";

it("should run the seed script without errors", async () => {
  await expect(main()).resolves.not.toThrow();
});

it("seeds one request per applicant and no pending requests for existing members", async () => {
  await main();
  await main();
  const requests = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.organizationId, "org_servicestart"));
  const memberships = await db
    .select()
    .from(members)
    .where(eq(members.organizationId, "org_servicestart"));
  const memberIds = new Set(memberships.map((member) => member.userId));
  expect(
    requests.filter(
      (request) =>
        request.status === JoinRequestStatus.Pending &&
        memberIds.has(request.userId),
    ),
  ).toEqual([]);
  for (const id of [
    "jr_pending_servicestart",
    "jr_approved_servicestart",
    "jr_denied_servicestart",
  ]) {
    const fixture = requests.find((request) => request.id === id)!;
    expect(fixture).toBeDefined();
    expect(
      requests.filter((request) => request.userId === fixture.userId),
    ).toHaveLength(1);
  }
  const approved = requests.find(
    (request) => request.id === "jr_approved_servicestart",
  )!;
  expect(memberIds.has(approved.userId)).toBe(true);
  const allNotifications = await db.select().from(notifications);
  const allRequests = await db.select().from(joinRequests);
  const requestIds = new Set(allRequests.map((request) => request.id));
  const linkedIds = allNotifications
    .map(
      (notification) =>
        (notification.metadata as { joinRequestId?: string } | null)
          ?.joinRequestId,
    )
    .filter((id): id is string => !!id);
  expect(linkedIds.every((id) => requestIds.has(id))).toBe(true);
});

it("reuses an approved applicant's existing membership and fully removes access", async () => {
  await main();
  const [request] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, "jr_approved_servicestart"));
  await db
    .delete(members)
    .where(
      and(
        eq(members.userId, request.userId),
        eq(members.organizationId, request.organizationId),
      ),
    );
  // Better Auth approvals create membership IDs independent of the seed's ID.
  await db.insert(members).values({
    id: "previously-approved-membership",
    userId: request.userId,
    organizationId: request.organizationId,
    role: "member",
  });
  await main();
  await main();
  const memberships = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.userId, request.userId),
        eq(members.organizationId, request.organizationId),
      ),
    );
  expect(memberships.map((membership) => membership.id)).toEqual([
    "previously-approved-membership",
  ]);
  const session = await auth.api.signInEmail({
    body: {
      email: "admin@example.com",
      password: DEFAULT_TEST_PASSWORD,
    },
    headers: new Headers({ host: "localhost:3000" }),
    returnHeaders: true,
  });
  await JoinRequestsService.updateStatus(
    request.id,
    JoinRequestStatus.Pending,
    session.response.user.id,
    new Headers({ cookie: session.headers.get("set-cookie")! }),
    undefined,
    JoinRequestStatus.Approved,
  );
  expect(
    await MembersService.findByUserAndOrganization(
      request.userId,
      request.organizationId,
    ),
  ).toBeNull();
});

it("retains pending requests with review history when reseeding", async () => {
  await main();
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.organizationId, "org_servicestart"));
  await db.insert(joinRequests).values({
    id: "reviewed-request",
    userId: member.userId,
    organizationId: member.organizationId,
    status: JoinRequestStatus.Pending,
  });
  await db.insert(joinRequestHistory).values({
    id: "review-history",
    joinRequestId: "reviewed-request",
    action: "removed",
    resolvedByUserId: member.userId,
  });
  await main();
  expect(
    await db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.id, "reviewed-request")),
  ).toHaveLength(1);
  expect(
    await db
      .select()
      .from(joinRequestHistory)
      .where(eq(joinRequestHistory.id, "review-history")),
  ).toHaveLength(1);
});

it("should create an organization with the slug 'servicestart'", async () => {
  await main();

  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "servicestart"))
    .limit(1);

  expect(org.length).toBe(1);
});

it("should not create duplicate organizations on multiple runs", async () => {
  await main();
  await main(); // Run the seed script twice

  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "servicestart"));

  expect(orgs.length).toBe(1); // Only one organization with the slug 'servicestart' should exist
});

it("doesn't duplicate notifications on multiple runs", async () => {
  await main();
  const [first] = await db.select({ count: count() }).from(notifications);
  await main();
  const [second] = await db.select({ count: count() }).from(notifications);

  expect(first.count).toBeGreaterThan(0);
  expect(second.count).toBe(first.count);
});

it("creates users/accounts such that they can be signed into", async () => {
  await main();

  const res = await auth.api.signInEmail({
    headers: new Headers({ host: "localhost:3000" }),
    body: {
      email: "owner@example.com",
      password: DEFAULT_TEST_PASSWORD,
    },
  });

  expect(res.token).toBeTruthy();
  expect(res.user.email).toBe("owner@example.com");
});

it("creates distinct admin accounts that can sign in to each seeded tenant", async () => {
  await main();
  await main();
  const admins = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@example.com"));
  expect(admins).toHaveLength(5);
  expect(new Set(admins.map((user) => user.organizationId)).size).toBe(5);
  expect(
    await db.select().from(users).where(isNull(users.organizationId)),
  ).toHaveLength(0);
  for (const org of await db.select().from(organizations)) {
    const res = await auth.api.signInEmail({
      headers: new Headers({ host: `${org.slug}.lvh.me:3000` }),
      body: { email: "admin@example.com", password: DEFAULT_TEST_PASSWORD },
    });
    expect(res.token).toBeTruthy();
    expect(res.user.id).toBe(
      admins.find((user) => user.organizationId === org.id)?.id,
    );
  }
});

it("seeds repeatable Visionaries branding and tenant-scoped development roles", async () => {
  await main();
  await main();
  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "visionariestothethrone"));
  expect(orgs).toHaveLength(1);
  const org = orgs[0];
  expect(org.name).toBe("Visionaries to the Throne");
  const configs = await db
    .select()
    .from(organizationConfig)
    .where(eq(organizationConfig.organizationId, org.id));
  const config = Object.fromEntries(configs.map((row) => [row.key, row.value]));
  expect(config[OrganizationConfigKey.PrimaryColor]).toBe("#5C218C");
  expect(config[OrganizationConfigKey.SecondaryColor]).toBe("#C29BDC");
  expect(config[OrganizationConfigKey.Tagline]).toBe(
    "Visionaries to the Throne",
  );
  expect(new Set(configs.map((row) => row.key)).size).toBe(configs.length);
  const memberships = await db
    .select()
    .from(members)
    .where(eq(members.organizationId, org.id));
  for (const [email, role] of [
    ["owner@example.com", "owner"],
    ["admin@example.com", "admin"],
    ["member1@example.com", "member"],
    ["nonmember@example.com", null],
  ]) {
    const result = await auth.api.signInEmail({
      headers: new Headers({ host: "visionariestothethrone.lvh.me:3000" }),
      body: { email: email!, password: DEFAULT_TEST_PASSWORD },
    });
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, result.user.id));
    expect(user.organizationId).toBe(org.id);
    expect(
      memberships.find((member) => member.userId === user.id)?.role ?? null,
    ).toBe(role);
  }
  const defaults = await db
    .select()
    .from(organizationConfig)
    .where(eq(organizationConfig.organizationId, "org_servicestart"));
  expect(defaults.some((row) => row.value === "#5C218C")).toBe(false);
});

it("turns on forms for Visionaries only", async () => {
  await main();

  for (const [orgId, enabled] of [
    ["org_visionariestothethrone", true],
    ["org_servicestart", false],
  ] as const) {
    const config = await OrganizationConfigService.getConfig(orgId, [
      OrganizationConfigKey.FormsEnabled,
    ]);
    expect(config[OrganizationConfigKey.FormsEnabled]).toBe(enabled);
  }
});

it("seeds one published copy of the Visionaries application", async () => {
  await main();
  await main();

  const seeded = await db
    .select()
    .from(forms)
    .where(eq(forms.organizationId, "org_visionariestothethrone"));
  expect(seeded).toHaveLength(1);
  const [form] = seeded;
  const components = await db
    .select()
    .from(formComponents)
    .where(eq(formComponents.formId, form.id))
    .orderBy(asc(formComponents.position));
  const definition = FormDefinitionSchema.parse({
    ...form,
    components: components.map(
      ({ id, type, label, helpText, required, position, config }) => ({
        id,
        type,
        label,
        helpText,
        required,
        position,
        config,
      }),
    ),
  });
  expect(definition).toEqual(VISIONARIES_APPLICATION_FORM);

  const [creator] = await db
    .select()
    .from(users)
    .where(eq(users.id, form.createdBy!));
  expect(creator.email).toBe("admin@example.com");
  expect(creator.organizationId).toBe("org_visionariestothethrone");
});

it("won't overwrite another form with the application's form ID", async () => {
  await main();
  await db.delete(forms).where(eq(forms.id, VISIONARIES_APPLICATION_FORM.id));
  const draft = await createForm("org_visionariestothethrone", {
    formId: VISIONARIES_APPLICATION_FORM.formId,
    components: [],
  });

  await expect(main()).rejects.toThrow(
    `Visionaries already has a form with the ID "${VISIONARIES_APPLICATION_FORM.formId}"`,
  );
  const [stored] = await db.select().from(forms).where(eq(forms.id, draft.id));
  expect(stored.status).toBe(FormStatus.Draft);
});

it("seeds a Visionaries applicant who can sign in", async () => {
  await main();

  const result = await auth.api.signInEmail({
    headers: new Headers({ host: "visionariestothethrone.lvh.me:3000" }),
    body: { email: "applicant@example.com", password: DEFAULT_TEST_PASSWORD },
  });
  const [membership] = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.userId, result.user.id),
        eq(members.organizationId, "org_visionariestothethrone"),
      ),
    );
  expect(membership.role).toBe("member");
  expect(membership.memberType).toBe(MemberType.Applicant);

  // Reseeding restores the type on an existing membership.
  await db
    .update(members)
    .set({ memberType: null })
    .where(eq(members.id, membership.id));
  await main();
  const [retyped] = await db
    .select()
    .from(members)
    .where(eq(members.id, membership.id));
  expect(retyped.memberType).toBe(MemberType.Applicant);
  expect(
    await db
      .select()
      .from(users)
      .where(eq(users.email, "applicant@example.com")),
  ).toHaveLength(1);
});

it("repairs an old unscoped seed account without replacing its ID or credential", async () => {
  const password = await hashPassword(DEFAULT_TEST_PASSWORD);
  await db.insert(users).values({
    id: "legacy-admin",
    name: "Admin User",
    email: "admin@example.com",
  });
  await db.insert(accounts).values({
    id: "legacy-credential",
    accountId: "legacy-admin",
    userId: "legacy-admin",
    providerId: "credential",
    password,
  });
  await main();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, "legacy-admin"));
  expect(user.organizationId).toBe("org_servicestart");
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, "legacy-credential"));
  expect(account.password).toBe(password);
  const res = await auth.api.signInEmail({
    headers: new Headers({ host: "localhost:3000" }),
    body: { email: "admin@example.com", password: DEFAULT_TEST_PASSWORD },
  });
  expect(res.user.id).toBe("legacy-admin");
});
