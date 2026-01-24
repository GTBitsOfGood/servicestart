import { auth } from "@/lib/auth";

export const baseTestUser = {
  email: "test@example.com",
  password: "password123",
  name: "Test User",
};

/**
 * Signs up a test user, which you can use to run API routes.
 * 
 * For example, you can get the session like so:
 * ```ts
 * const data = await createTestUser();
 * const session = await auth.api.getSession({
      headers: data.headers,
    });
 * ```

 * @returns an object with the user, their token, and the relevant request headers
 */
export async function createTestUser() {
  const userNumber = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  const user: typeof baseTestUser = {
    ...baseTestUser,
    email: `testuser${userNumber}@example.com`,
    name: `Test User ${userNumber}`,
  };

  const res = await auth.api.signUpEmail({
    body: user,
    returnHeaders: true,
  });

  if (!res.response.user || !res.response.token) {
    throw new Error("Failed to create test user");
  }

  if (!res.headers.get("set-cookie")) {
    throw new Error("No set-cookie header found");
  }

  return {
    user: res.response.user,
    token: res.response.token!,
    headers: {
      Cookie: res.headers.get("set-cookie")!,
    },
  };
}
