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
  formSubmissions,
  formUploads,
  FormStatus,
  MemberType,
  NotificationType,
  SubmissionReviewStatus,
  events,
  notifications,
  joinRequests,
  joinRequestHistory,
  JoinRequestStatus,
} from "@/lib/schema";
import { FormDefinitionSchema } from "@/lib/forms/schema";
import { FormProgressService } from "@/lib/services/FormProgressService";
import { FormSubmissionService } from "@/lib/services/FormSubmissionService";
import { InformationRequestService } from "@/lib/services/InformationRequestService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { hashPassword } from "better-auth/crypto";
import { main } from "@/scripts/seed";
import { InvitationService } from "@/lib/services/InvitationService";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import { MembersService } from "@/lib/services/MemberService";
import { UserService } from "@/lib/services/UserService";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  createForm,
  createFormSubmission,
  DEFAULT_TEST_PASSWORD,
  VISIONARIES_APPLICATION_FORM,
  VISIONARIES_ATTENDEE_FORMS,
  VISIONARIES_DEMO_FORMS,
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
  expect(admins).toHaveLength(7);
  expect(new Set(admins.map((user) => user.organizationId)).size).toBe(7);
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
  expect(config[OrganizationConfigKey.BackgroundColor]).toBe("#FFFEF1");
  expect(config[OrganizationConfigKey.TextColor]).toBe("#373444");
  expect(config[OrganizationConfigKey.DisplayFont]).toBe("fredoka");
  expect(config[OrganizationConfigKey.HeadingFont]).toBe("lexend");
  expect(config[OrganizationConfigKey.BodyFont]).toBe("lexend");
  expect(config[OrganizationConfigKey.CornerStyle]).toBe("pill");
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

it("turns on member types and auto-approve for Visionaries only", async () => {
  await main();

  for (const [orgId, enabled] of [
    ["org_visionariestothethrone", true],
    ["org_servicestart", false],
  ] as const) {
    const config = await OrganizationConfigService.getConfig(orgId, [
      OrganizationConfigKey.MemberTypesEnabled,
      OrganizationConfigKey.AutoApproveSignups,
    ]);
    expect(config).toEqual({
      [OrganizationConfigKey.MemberTypesEnabled]: enabled,
      [OrganizationConfigKey.AutoApproveSignups]: enabled,
    });
  }
});

async function storedDefinition(formUuid: string) {
  const [form] = await db.select().from(forms).where(eq(forms.id, formUuid));
  const components = await db
    .select()
    .from(formComponents)
    .where(eq(formComponents.formId, form.id))
    .orderBy(asc(formComponents.position));
  return {
    form,
    definition: FormDefinitionSchema.parse({
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
    }),
  };
}

it("seeds one copy of each Visionaries form", async () => {
  await main();
  await main();

  const seeded = await db
    .select()
    .from(forms)
    .where(eq(forms.organizationId, "org_visionariestothethrone"));
  const fixtures = [
    VISIONARIES_APPLICATION_FORM,
    ...VISIONARIES_ATTENDEE_FORMS,
    ...VISIONARIES_DEMO_FORMS,
  ];
  expect(seeded.map(({ id }) => id).sort()).toEqual(
    fixtures.map(({ id }) => id).sort(),
  );
  for (const fixture of fixtures) {
    const { form, definition } = await storedDefinition(fixture.id);
    expect(definition).toEqual(fixture);
    const [creator] = await db
      .select()
      .from(users)
      .where(eq(users.id, form.createdBy!));
    expect(creator.email).toBe("admin@example.com");
    expect(creator.organizationId).toBe("org_visionariestothethrone");
  }
});

it("won't overwrite another form with the application's form ID", async () => {
  await main();
  await db.delete(forms).where(eq(forms.id, VISIONARIES_APPLICATION_FORM.id));
  const draft = await createForm("org_visionariestothethrone", {
    formId: VISIONARIES_APPLICATION_FORM.formId,
    components: [],
  });

  await expect(main()).rejects.toThrow(
    `Visionaries to the Throne already has a form with the ID "${VISIONARIES_APPLICATION_FORM.formId}"`,
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
      .where(
        and(
          eq(users.email, "applicant@example.com"),
          eq(users.organizationId, "org_visionariestothethrone"),
        ),
      ),
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

const VISIONARIES = "org_visionariestothethrone";

async function visionariesUser(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.organizationId, VISIONARIES)));
  const [membership] = await db
    .select()
    .from(members)
    .where(
      and(eq(members.userId, user.id), eq(members.organizationId, VISIONARIES)),
    );
  return { user, membership };
}

async function progressOf(email: string) {
  const { user, membership } = await visionariesUser(email);
  return FormProgressService.listForMember(
    VISIONARIES,
    user.id,
    membership.memberType,
  );
}

it("seeds a Visionaries account at every stage of the camp process", async () => {
  await main();

  const application = async (email: string) =>
    (await progressOf(email)).find(
      ({ form }) => form.id === VISIONARIES_APPLICATION_FORM.id,
    )?.submission?.reviewStatus ?? null;
  const attendeeFormsDone = async (email: string) =>
    (await progressOf(email)).filter(
      ({ required, submission }) => required && submission,
    ).length;

  for (const [email, memberType, status, done] of [
    ["applicant@example.com", MemberType.Applicant, null, 0],
    [
      "applicant-pending@example.com",
      MemberType.Applicant,
      SubmissionReviewStatus.Pending,
      1,
    ],
    [
      "applicant-review@example.com",
      MemberType.Applicant,
      SubmissionReviewStatus.UnderReview,
      1,
    ],
    [
      "member2@example.com",
      MemberType.Attendee,
      SubmissionReviewStatus.Accepted,
      0,
    ],
    [
      "member1@example.com",
      MemberType.Attendee,
      SubmissionReviewStatus.Accepted,
      2,
    ],
    [
      "attendee-complete@example.com",
      MemberType.Attendee,
      SubmissionReviewStatus.Accepted,
      4,
    ],
  ] as const) {
    const { membership } = await visionariesUser(email);
    // Applicants' one required form is the application itself.
    expect({
      email,
      memberType: membership.memberType,
      application: await application(email),
      done: await attendeeFormsDone(email),
    }).toEqual({ email, memberType, application: status, done });
  }

  const result = await auth.api.signInEmail({
    headers: new Headers({ host: "visionariestothethrone.lvh.me:3000" }),
    body: {
      email: "attendee-complete@example.com",
      password: DEFAULT_TEST_PASSWORD,
    },
  });
  expect(result.user.email).toBe("attendee-complete@example.com");
});

it("resets the Visionaries accounts' responses when reseeding", async () => {
  await main();
  const { user: pending } = await visionariesUser(
    "applicant-pending@example.com",
  );
  const { user: member2 } = await visionariesUser("member2@example.com");
  await db
    .update(formSubmissions)
    .set({ reviewStatus: SubmissionReviewStatus.Accepted })
    .where(eq(formSubmissions.userId, pending.id));
  await createFormSubmission(
    { id: VISIONARIES_ATTENDEE_FORMS[0].id, organizationId: VISIONARIES },
    { userId: member2.id },
  );

  await main();

  expect(
    (await progressOf("applicant-pending@example.com"))[0].submission
      ?.reviewStatus,
  ).toBe(SubmissionReviewStatus.Pending);
  expect(
    (await progressOf("member2@example.com")).filter(
      ({ required, submission }) => required && submission,
    ),
  ).toHaveLength(0);
});

it("removes requests to complete the seeded forms when reseeding", async () => {
  await main();
  const { user: admin } = await visionariesUser("admin@example.com");
  const { user: member1 } = await visionariesUser("member1@example.com");
  await InformationRequestService.request({
    organizationId: VISIONARIES,
    userId: member1.id,
    formId: VISIONARIES_ATTENDEE_FORMS[2].formId,
    requestedBy: admin.id,
  });

  await main();

  await expect(
    InformationRequestService.request({
      organizationId: VISIONARIES,
      userId: member1.id,
      formId: VISIONARIES_ATTENDEE_FORMS[2].formId,
      requestedBy: admin.id,
    }),
  ).resolves.toBeTruthy();
});

it("resets the Visionaries demo forms when reseeding", async () => {
  await main();
  const [draft, closed] = VISIONARIES_DEMO_FORMS;
  const { user: member1 } = await visionariesUser("member1@example.com");
  // Try them out: rename and publish the draft, answer it, and reopen the
  // closed form.
  await db
    .update(forms)
    .set({ formId: "renamed-rsvp", status: FormStatus.Published })
    .where(eq(forms.id, draft.id));
  await db
    .update(forms)
    .set({ status: FormStatus.Published })
    .where(eq(forms.id, closed.id));
  await createFormSubmission(
    { id: draft.id, organizationId: VISIONARIES },
    { userId: member1.id },
  );

  await main();

  for (const fixture of VISIONARIES_DEMO_FORMS) {
    expect((await storedDefinition(fixture.id)).definition).toEqual(fixture);
  }
  expect(
    await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, draft.id)),
  ).toEqual([]);
  // They aren't anyone's required forms.
  const demoFormIds = VISIONARIES_DEMO_FORMS.map(({ id }) => id);
  for (const email of ["applicant@example.com", "member1@example.com"]) {
    expect(
      (await progressOf(email)).filter(({ form }) =>
        demoFormIds.includes(form.id),
      ),
    ).toEqual([]);
  }
});

it("seeds a Visionaries invitation for each accept-page state, open again on reseed", async () => {
  await main();
  const isOpen = async (id: string) =>
    InvitationService.isOpen(
      (await InvitationService.findByIdAndOrganization(id, VISIONARIES))!,
    );
  expect(await isOpen("visionaries-invite-counselor")).toBe(true);
  expect(await isOpen("visionaries-invite-nonmember")).toBe(true);
  expect(await isOpen("visionaries-invite-expired")).toBe(false);
  // One invitee has no account yet; the other has one but isn't a member.
  expect(
    await UserService.findByEmailAndOrganization(
      "counselor@example.com",
      VISIONARIES,
    ),
  ).toBeFalsy();
  const { user: nonmember, membership } = await visionariesUser(
    "nonmember@example.com",
  );
  expect(membership).toBeUndefined();

  // Accept both, as the invitees would.
  const { user: counselor } = await auth.api.signUpEmail({
    headers: new Headers({ host: "visionariestothethrone.lvh.me:3000" }),
    body: {
      email: "counselor@example.com",
      password: DEFAULT_TEST_PASSWORD,
      name: "Jordan Reed",
    },
  });
  expect(
    await InvitationService.acceptForUser(
      "visionaries-invite-counselor",
      VISIONARIES,
      counselor,
    ),
  ).toBe("admin");
  expect(
    await InvitationService.acceptForUser(
      "visionaries-invite-nonmember",
      VISIONARIES,
      nonmember,
    ),
  ).toBe("member");

  await main();

  expect(await isOpen("visionaries-invite-counselor")).toBe(true);
  expect(await isOpen("visionaries-invite-nonmember")).toBe(true);
  expect(
    await db.select().from(users).where(eq(users.id, counselor.id)),
  ).toEqual([]);
  expect(
    (await visionariesUser("nonmember@example.com")).membership,
  ).toBeUndefined();
});

it("restores recreated Visionaries students' membership, responses, and image access", async () => {
  // AutoApproveSignups is on after the first seed, so signing a new account
  // up makes it a member before the seed adds its membership.
  await main();
  const { user } = await visionariesUser("attendee-complete@example.com");
  const originalResponses = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.userId, user.id));
  const [headshot] = await db
    .select()
    .from(formUploads)
    .where(eq(formUploads.uploadedBy, user.id));
  expect(originalResponses.length).toBeGreaterThan(0);
  expect(headshot).toBeDefined();
  await db.delete(users).where(eq(users.id, user.id));

  await main();

  const { user: recreated } = await visionariesUser(
    "attendee-complete@example.com",
  );
  expect(
    await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.userId, recreated.id),
          eq(members.organizationId, VISIONARIES),
        ),
      ),
  ).toHaveLength(1);
  const restoredResponses = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.userId, recreated.id));
  expect(restoredResponses.map((row) => row.id).sort()).toEqual(
    originalResponses.map((row) => row.id).sort(),
  );
  expect(
    await FormSubmissionService.getMemberSubmission(
      VISIONARIES,
      VISIONARIES_APPLICATION_FORM.formId,
      recreated.id,
    ),
  ).not.toBeNull();
  expect(
    await FormSubmissionService.getMemberUpload(
      VISIONARIES,
      VISIONARIES_APPLICATION_FORM.formId,
      headshot.id,
      recreated.id,
    ),
  ).not.toBeNull();
  expect(
    await FormSubmissionService.getMemberUpload(
      "org_servicestart",
      VISIONARIES_APPLICATION_FORM.formId,
      headshot.id,
      recreated.id,
    ),
  ).toBeNull();
});

it("restores recreated Visionaries owner and admin roles without duplicate memberships", async () => {
  await main();
  for (const email of ["owner@example.com", "admin@example.com"]) {
    const { user } = await visionariesUser(email);
    await db.delete(users).where(eq(users.id, user.id));
  }
  await main();
  for (const [email, role] of [
    ["owner@example.com", "owner"],
    ["admin@example.com", "admin"],
  ]) {
    const { user, membership } = await visionariesUser(email);
    expect(membership.role).toBe(role);
    expect(
      await db
        .select()
        .from(members)
        .where(
          and(
            eq(members.userId, user.id),
            eq(members.organizationId, VISIONARIES),
          ),
        ),
    ).toHaveLength(1);
  }
});

it("configures Visionaries' logo, dashboards, header, navbar, and footer", async () => {
  await main();

  const config = await OrganizationConfigService.getConfig(VISIONARIES, [
    OrganizationConfigKey.LogoUrl,
    OrganizationConfigKey.ApplicantDashboardLayout,
    OrganizationConfigKey.AttendeeDashboardLayout,
    OrganizationConfigKey.DashboardHeader,
    OrganizationConfigKey.NavbarConfig,
    OrganizationConfigKey.OrganizationFooter,
  ]);

  expect(config[OrganizationConfigKey.LogoUrl]).toBe(
    "/organizations/visionaries-logo.png",
  );
  expect(
    (
      await OrganizationConfigService.getDashboardLayoutFor(
        VISIONARIES,
        "applicant",
      )
    ).widgets.map(({ id }) => id),
  ).toEqual(["application_status", "notifications"]);
  expect(
    (
      await OrganizationConfigService.getDashboardLayoutFor(
        VISIONARIES,
        "attendee",
      )
    ).widgets.map(({ id }) => id),
  ).toEqual([
    "forms_todo",
    "weekly_calendar",
    "forms_completed",
    "forms_progress",
  ]);
  expect(config[OrganizationConfigKey.DashboardHeader].attendee.title).toBe(
    "My Building Your Throne Summer 2027 Dashboard",
  );
  expect(config[OrganizationConfigKey.NavbarConfig].applicant.hidden).toEqual([
    "/events",
  ]);
  expect(config[OrganizationConfigKey.OrganizationFooter].ein).toBe(
    "84-4516921",
  );

  const defaults = await OrganizationConfigService.getConfig(
    "org_servicestart",
    [OrganizationConfigKey.DashboardHeader, OrganizationConfigKey.NavbarConfig],
  );
  expect(defaults).toEqual({
    [OrganizationConfigKey.DashboardHeader]: {},
    [OrganizationConfigKey.NavbarConfig]: {},
  });
});

it("dates Visionaries' camp events from the current week", async () => {
  await main();

  const seeded = await db
    .select()
    .from(events)
    .where(eq(events.organizationId, VISIONARIES));
  expect(seeded).toHaveLength(5);
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  for (const event of seeded) {
    expect(event.publishedAt).not.toBeNull();
    expect(Math.abs(event.startTimestamp!.getTime() - now)).toBeLessThan(
      2 * week,
    );
  }
});

it("gives Visionaries' accepted campers one unread alert and no sample notifications", async () => {
  await main();
  const { user } = await visionariesUser("member1@example.com");
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, user.id));

  await main();

  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, user.id),
        eq(notifications.organizationId, VISIONARIES),
      ),
    );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    type: NotificationType.Announcement,
    read: false,
  });
  expect(rows[0].text).toMatch(/^Camp will be cancelled on /);

  const { user: applicant } = await visionariesUser(
    "applicant-pending@example.com",
  );
  expect(
    await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, applicant.id)),
  ).toHaveLength(0);
});

it("seeds independent development tenants with useful volunteer and application workflows", async () => {
  await main();
  for (const slug of ["volunteerstart", "applicationstart"]) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug));
    expect(org).toBeDefined();
    const login = await auth.api.signInEmail({
      headers: new Headers({ host: `${slug}.lvh.me:3000` }),
      body: { email: "admin@example.com", password: DEFAULT_TEST_PASSWORD },
    });
    const [storedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, login.user.id));
    expect(storedUser.organizationId).toBe(org.id);
    const tenantForms = await db
      .select()
      .from(forms)
      .where(eq(forms.organizationId, org.id));
    expect(new Set(tenantForms.map((form) => form.status))).toEqual(
      new Set([FormStatus.Published, FormStatus.Draft, FormStatus.Closed]),
    );
    const tenantEvents = await db
      .select()
      .from(events)
      .where(eq(events.organizationId, org.id));
    expect(tenantEvents.length).toBeGreaterThanOrEqual(3);
    expect(
      tenantEvents.some(
        (event) =>
          event.publishedAt &&
          event.startTimestamp &&
          event.startTimestamp > new Date(),
      ),
    ).toBe(true);
  }
  const requests = await db
    .select()
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.organizationId, "org_volunteerstart"),
        inArray(joinRequests.id, [
          "jr_pending_volunteerstart",
          "jr_approved_volunteerstart",
          "jr_denied_volunteerstart",
        ]),
      ),
    );
  expect(requests.map((request) => request.status).sort()).toEqual([
    "approved",
    "denied",
    "pending",
  ]);
  const statuses = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.organizationId, "org_applicationstart"));
  expect(
    new Set(statuses.map((submission) => submission.reviewStatus)),
  ).toEqual(new Set(Object.values(SubmissionReviewStatus)));
  for (const [email, completed] of [
    ["member2@example.com", 0],
    ["member1@example.com", 2],
    ["attendee-complete@example.com", 4],
  ] as const) {
    const [member] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.organizationId, "org_applicationstart"),
          eq(users.email, email),
        ),
      );
    const progress = await FormProgressService.listForMember(
      "org_applicationstart",
      member.id,
      MemberType.Attendee,
    );
    expect(progress.filter((item) => item.required)).toHaveLength(4);
    expect(
      progress.filter((item) => item.required && item.submission),
    ).toHaveLength(completed);
    expect(
      progress
        .filter((item) => item.required)
        .every((item) => item.form.availability === "open"),
    ).toBe(true);
    expect(
      await FormProgressService.listForMember(
        "org_volunteerstart",
        member.id,
        MemberType.Attendee,
      ),
    ).toEqual([]);
  }
});

it("reseed restores development fixtures without deleting unrelated work or changing account IDs", async () => {
  await main();
  const [applicant] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.organizationId, "org_applicationstart"),
        eq(users.email, "applicant-pending@example.com"),
      ),
    );
  expect(applicant).toBeDefined();
  const custom = await createForm("org_applicationstart", {
    createdBy: applicant.id,
  });
  await db
    .update(formSubmissions)
    .set({ reviewStatus: SubmissionReviewStatus.Rejected })
    .where(eq(formSubmissions.userId, applicant.id));
  const before = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.organizationId, "org_applicationstart"));
  await main();
  const after = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.organizationId, "org_applicationstart"));
  expect(after).toHaveLength(before.length);
  expect(after.find((row) => row.userId === applicant.id)?.reviewStatus).toBe(
    SubmissionReviewStatus.Pending,
  );
  expect(
    await db.select().from(forms).where(eq(forms.id, custom.id)),
  ).toHaveLength(1);
  const login = await auth.api.signInEmail({
    headers: new Headers({ host: "applicationstart.lvh.me:3000" }),
    body: { email: applicant.email, password: DEFAULT_TEST_PASSWORD },
  });
  expect(login.user.id).toBe(applicant.id);
});
