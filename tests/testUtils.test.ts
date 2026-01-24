import { describe, expect, it } from "vitest";
import { createTestUser } from "@/tests/testUtils";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { sessions } from "@/lib/schema";
import { eq } from "drizzle-orm";

describe(createTestUser.name, () => {
  it("should create a test user successfully", async () => {
    const data = await createTestUser();

    expect(data.token).toBeDefined();
    expect(data.token!.length).toBeGreaterThan(0);

    expect(data.user).toBeDefined();
    expect(data.user.email.length).toBeGreaterThan(0);
    expect(data.user.name.length).toBeGreaterThan(0);
  });

  it("creates a session for the test user", async () => {
    const data = await createTestUser();

    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.token, data.token!))
      .limit(1)
      .then((res) => res[0]);

    expect(session).toBeDefined();
    expect(session!.userId).toBe(data.user.id);

    const foundSession = await auth.api.getSession({
      headers: data.headers,
    });

    expect(foundSession).toBeTruthy();
    expect(foundSession!.session).toBeTruthy();
    expect(foundSession!.user).toBeTruthy();
    expect(foundSession!.session.id).toBe(session!.id);
  });
});
