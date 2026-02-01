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
    process.env.DB_URL = "postgres://user:pass@host:5432/<branch>";
    process.env.NEXT_PUBLIC_BRANCH_NAME = "feature-xyz";

    const url = getDbUrl();
    expect(url).toBe('postgres://user:pass@host:5432/"feature-xyz"');
  });

  it("removes the pull/ prefix from NEXT_PUBLIC_BRANCH_NAME", () => {
    process.env.DB_URL = "postgres://user:pass@host:5432/<branch>";
    process.env.NEXT_PUBLIC_BRANCH_NAME = "pull/123";

    const url = getDbUrl();
    expect(url).toBe('postgres://user:pass@host:5432/"123"');

    process.env.NEXT_PUBLIC_BRANCH_NAME = '"pull/123"';
    const url2 = getDbUrl();
    expect(url2).toBe('postgres://user:pass@host:5432/"123"');
  });
});
