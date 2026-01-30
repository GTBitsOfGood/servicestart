import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { joinRequests, members } from "@/lib/schema";
import {
  buildHost,
  buildTestUser,
  createOrganization,
} from "../helpers/joinRequests";

async function getJoinRequests(userId: string, organizationId: string) {
  return db
    .select()
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.userId, userId),
        eq(joinRequests.organizationId, organizationId),
      ),
    );
}

describe("join request hooks", () => {
  it("creates a join request for the subdomain slug on sign up", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();

    const result = await auth.api.signUpEmail({
      body: user,
      headers: { host: buildHost("acme") },
    });

    const requests = await getJoinRequests(result.user.id, organization.id);

    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe("pending");
  });

  it("defaults the slug to servicestart when host is not a subdomain", async () => {
    const organization = await createOrganization("servicestart");
    const user = buildTestUser();

    const result = await auth.api.signUpEmail({
      body: user,
      headers: { host: "servicestart.com" },
    });

    const requests = await getJoinRequests(result.user.id, organization.id);

    expect(requests).toHaveLength(1);
  });

  it("does not create a join request when the user is already a member", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();

    const signUpResult = await auth.api.signUpEmail({
      body: user,
      headers: { host: buildHost("acme") },
    });

    await db
      .delete(joinRequests)
      .where(eq(joinRequests.userId, signUpResult.user.id));

    await db.insert(members).values({
      id: randomUUID(),
      userId: signUpResult.user.id,
      organizationId: organization.id,
      role: "member",
    });

    await auth.api.signInEmail({
      body: {
        email: user.email,
        password: user.password,
      },
      headers: { host: buildHost("acme") },
    });

    const requests = await getJoinRequests(
      signUpResult.user.id,
      organization.id,
    );

    expect(requests).toHaveLength(0);
  });

  it("does not create duplicate join requests on sign in", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();

    const signUpResult = await auth.api.signUpEmail({
      body: user,
      headers: { host: buildHost("acme") },
    });

    await auth.api.signInEmail({
      body: {
        email: user.email,
        password: user.password,
      },
      headers: { host: buildHost("acme") },
    });

    const requests = await getJoinRequests(
      signUpResult.user.id,
      organization.id,
    );

    expect(requests).toHaveLength(1);
  });
});
