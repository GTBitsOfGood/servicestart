import db from "@/lib/db";
import { users } from "@/lib/schema";
import { describe, expect, it } from "vitest";

describe("beforeEach", () => {
  db.insert(users).values([
    {
      name: "Test User",
      email: "test@test.com",
      emailVerified: true,
      image: "https://example.com/avatar.png",
    },
  ]);

  it("wipes the database before each test", async () => {
    const res = await db.select().from(users);

    expect(res.length).toBe(0);
  });
});
