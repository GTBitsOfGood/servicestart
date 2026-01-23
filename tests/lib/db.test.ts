import db from "@/lib/db";
import { it, expect } from "vitest";

it("is connected to the database", async () => {
  const res = await db.execute("SELECT 1");

  expect(res.rowCount).toBe(1);
});
