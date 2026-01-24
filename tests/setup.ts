import db from "@/lib/db";
import { schema } from "@/lib/schema";
import { beforeEach } from "vitest";

beforeEach(async () => {
  // Wipe DB before each test
  await Promise.all(Object.values(schema).map((table) => db.delete(table)));
});
