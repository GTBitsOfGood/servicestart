// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import db from "@/core/db";
import { users } from "@/core/db/schema";
import { OrganizationConfigKey } from "@/core/config/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import { memberTypeInUseMessage } from "@/features/membership/lib/memberTypeErrors";
import {
  addMember,
  buildTestUser,
  createForm,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

async function setupOrgAndUser(role: "owner" | "admin" | "member") {
  const slug = `member-types-api-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const organization = await createOrganization(slug, { memberTypes: [] });
  const testUser = buildTestUser();
  const { user, session, headers } = await signUpAndGetSession(testUser);
  await setActiveOrganization(session.id, organization.id);
  await addMember(user.id, organization.id, role);
  return { organization, user, session, headers };
}

async function enableMemberTypes(organizationId: string) {
  await OrganizationConfigService.setConfig(
    organizationId,
    OrganizationConfigKey.MemberTypesEnabled,
    "true",
  );
}

describe("/api/memberTypes", () => {
  it("lists, creates, updates, reorders, sets signup default, and deletes", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    await enableMemberTypes(organization.id);

    const empty = await testApi.memberTypes.$get({}, { headers });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual([]);

    const created = await testApi.memberTypes.$post(
      { json: { label: "Volunteer", pluralLabel: "Volunteers" } },
      { headers },
    );
    expect(created.status).toBe(200);
    const volunteer = await created.json();
    expect(volunteer.key).toBe(MemberTypeKeySchema.parse("volunteer"));

    const second = await testApi.memberTypes.$post(
      { json: { label: "Board Member", pluralLabel: "Board Members" } },
      { headers },
    );
    expect(second.status).toBe(200);
    const board = await second.json();

    const listAfterCreate = await testApi.memberTypes.$get({}, { headers });
    expect(listAfterCreate.status).toBe(200);
    expect(await listAfterCreate.json()).toEqual([volunteer, board]);

    const patched = await testApi.memberTypes[":key"].$patch(
      {
        param: { key: volunteer.key },
        json: { label: "Helper", pluralLabel: "Helpers" },
      },
      { headers },
    );
    expect(patched.status).toBe(200);
    const helper = await patched.json();
    expect(helper.label).toBe("Helper");
    expect(helper.key).toBe(volunteer.key);

    const reordered = await testApi.memberTypes.order.$put(
      { json: [board.key, helper.key] },
      { headers },
    );
    expect(reordered.status).toBe(200);
    expect(
      (await reordered.json()).map((row: { key: string }) => row.key),
    ).toEqual([board.key, helper.key]);

    const setDefault = await testApi.memberTypes.signupDefault.$put(
      { json: { key: helper.key } },
      { headers },
    );
    expect(setDefault.status).toBe(200);

    const listWithDefault = await testApi.memberTypes.$get({}, { headers });
    const rows = await listWithDefault.json();
    expect(
      rows.filter((row: { isSignupDefault: boolean }) => row.isSignupDefault),
    ).toHaveLength(1);
    expect(
      rows.find((row: { isSignupDefault: boolean }) => row.isSignupDefault)
        ?.key,
    ).toBe(helper.key);

    const clearDefault = await testApi.memberTypes.signupDefault.$put(
      { json: { key: null } },
      { headers },
    );
    expect(clearDefault.status).toBe(200);

    const deleted = await testApi.memberTypes[":key"].$delete(
      { param: { key: helper.key } },
      { headers },
    );
    expect(deleted.status).toBe(200);

    const finalList = await testApi.memberTypes.$get({}, { headers });
    expect(finalList.status).toBe(200);
    expect(await finalList.json()).toEqual([
      expect.objectContaining({ key: board.key }),
    ]);
  });

  it("returns 401 when signed out", async () => {
    expect((await testApi.memberTypes.$get()).status).toBe(401);
  });

  it("returns 403 for a member", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    await enableMemberTypes(organization.id);

    expect((await testApi.memberTypes.$get({}, { headers })).status).toBe(403);
  });

  it("returns 404 when MemberTypesEnabled is off", async () => {
    const { headers } = await setupOrgAndUser("admin");

    expect((await testApi.memberTypes.$get({}, { headers })).status).toBe(404);
    expect(
      (
        await testApi.memberTypes.$post(
          { json: { label: "Volunteer", pluralLabel: "Volunteers" } },
          { headers },
        )
      ).status,
    ).toBe(404);
  });

  it("returns 400 for a PATCH body that includes key", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    await enableMemberTypes(organization.id);

    const created = await testApi.memberTypes.$post(
      { json: { label: "Volunteer", pluralLabel: "Volunteers" } },
      { headers },
    );
    const row = await created.json();

    const badPatch = await testApi.memberTypes[":key"].$patch(
      {
        param: { key: row.key },
        // @ts-expect-error extra `key` is the case under test
        json: { label: "Nope", pluralLabel: "Nopes", key: "stolen" },
      },
      { headers },
    );
    expect(badPatch.status).toBe(400);

    const list = await testApi.memberTypes.$get({}, { headers });
    expect((await list.json())[0]).toMatchObject({
      key: row.key,
      label: "Volunteer",
    });
  });

  it("returns 409 with usage counts when a type is in use", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    await enableMemberTypes(organization.id);

    const created = await testApi.memberTypes.$post(
      { json: { label: "Helper", pluralLabel: "Helpers" } },
      { headers },
    );
    const type = await created.json();

    await createForm(organization.id, {
      settings: { assignedMemberTypes: [type.key] },
    });

    for (let index = 0; index < 2; index += 1) {
      const user = buildTestUser();
      const [row] = await db
        .insert(users)
        .values({
          id: randomUUID(),
          name: user.name,
          email: user.email,
          organizationId: organization.id,
        })
        .returning({ id: users.id });
      await addMember(row.id, organization.id, "member", type.key);
    }

    const response = await testApi.memberTypes[":key"].$delete(
      { param: { key: type.key } },
      { headers },
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({
      error: memberTypeInUseMessage(2, 1, "Helper"),
      members: 2,
      forms: 1,
    });
  });

  it("isolates organizations", async () => {
    const orgA = await createOrganization(
      `mt-api-a-${randomUUID().slice(0, 8)}`,
      {
        memberTypes: [],
      },
    );
    const orgB = await createOrganization(
      `mt-api-b-${randomUUID().slice(0, 8)}`,
      {
        memberTypes: [],
      },
    );
    await enableMemberTypes(orgA.id);
    await enableMemberTypes(orgB.id);

    const adminA = buildTestUser();
    const {
      user: userA,
      session: sessionA,
      headers: headersA,
    } = await signUpAndGetSession(adminA);
    await setActiveOrganization(sessionA.id, orgA.id);
    await addMember(userA.id, orgA.id, "admin");

    const adminB = buildTestUser();
    const {
      user: userB,
      session: sessionB,
      headers: headersB,
    } = await signUpAndGetSession(adminB);
    await setActiveOrganization(sessionB.id, orgB.id);
    await addMember(userB.id, orgB.id, "admin");

    const created = await testApi.memberTypes.$post(
      { json: { label: "Board", pluralLabel: "Boards" } },
      { headers: headersA },
    );
    const board = await created.json();

    expect(
      await testApi.memberTypes
        .$get({}, { headers: headersB })
        .then((r) => r.json()),
    ).toEqual([]);

    expect(
      (
        await testApi.memberTypes[":key"].$patch(
          {
            param: { key: board.key },
            json: { label: "Nope", pluralLabel: "Nopes" },
          },
          { headers: headersB },
        )
      ).status,
    ).toBe(404);

    expect(
      (
        await testApi.memberTypes[":key"].$delete(
          { param: { key: board.key } },
          { headers: headersB },
        )
      ).status,
    ).toBe(404);

    const stillBoard = await testApi.memberTypes.$get(
      {},
      { headers: headersA },
    );
    expect((await stillBoard.json())[0]).toMatchObject({
      key: board.key,
      label: "Board",
    });
  });
});
