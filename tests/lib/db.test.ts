import db, { getDbUrl } from "@/lib/db";
import { it, expect, describe, afterAll, beforeEach } from "vitest";

it("is connected to the database", async () => {
  const res = await db.execute("SELECT 1");

  expect(res.rowCount).toBe(1);
});

describe(getDbUrl, () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("replaces <branch> with NEXT_PUBLIC_BRANCH_NAME", () => {
    process.env.DB_URL = "postgres://user:pass@host:5432/db_<branch>";
    process.env.NEXT_PUBLIC_BRANCH_NAME = "feature-xyz";

    const url = getDbUrl();
    expect(url).toBe("postgres://user:pass@host:5432/db_feature-xyz");
  });
});
