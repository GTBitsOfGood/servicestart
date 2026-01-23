import db from "@/lib/db";
import { PgTable } from "drizzle-orm/pg-core";
import { beforeEach } from "vitest";

const tables: PgTable[] = [];

beforeEach(async () => {
  // Wipe DB before each test
  await Promise.all(tables.map((table) => db.delete(table)));
});
