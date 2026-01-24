import db from "@/lib/db";
import { tables } from "@/lib/schema";
import { beforeEach } from "vitest";

beforeEach(async () => {
  // Wipe DB before each test
  await Promise.all(tables.map((table) => db.delete(table)));
});
