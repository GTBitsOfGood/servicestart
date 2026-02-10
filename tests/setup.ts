import {
  accounts,
  announcements,
  invitations,
  joinRequests,
  members,
  organizations,
  sessions,
  users,
  verification,
  shifts,
  shiftRSVPs,
} from "@/lib/schema";
import { beforeEach, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { randomUUID } from "node:crypto";
import { testState } from "./testState";

let db: typeof import("@/lib/db").default;

beforeAll(async () => {
  const id = randomUUID().split("-")[0];
  const port = 5433 + Math.floor(Math.random() * 100);

  testState.dbName = `testdb_${id}`;
  testState.containerName = `test-db-${id}`;

  // Prefer IPv4 loopback (avoids ::1 / IPv6 localhost issues)
  const dbUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/${testState.dbName}`;
  process.env.DB_URL = dbUrl;

  // Start Postgres container
  execSync(
    `docker run --name ${testState.containerName} -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=${testState.dbName} -p 127.0.0.1:${port}:5432 -d postgres:15`,
    { stdio: "inherit" },
  );

  // Wait until Postgres is ready
  for (let i = 0; i < 30; i++) {
    try {
      execSync(
        `docker exec ${testState.containerName} pg_isready -U postgres -d ${testState.dbName}`,
        { stdio: "ignore" },
      );
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Run migrations against THIS dbUrl
  execSync(`pnpm db:migrate`, {
    stdio: "inherit",
    env: { ...process.env, DB_URL: dbUrl },
  });

  // Import db AFTER env is set and DB exists
  db = (await import("@/lib/db")).default;
});

beforeEach(async () => {
  if (!db) throw new Error("DB not initialized yet (beforeAll did not run)");

  // Child tables first, then parent tables
  // Add line here when you create a new table
  await db.delete(shiftRSVPs);
  await db.delete(shifts);
  await db.delete(announcements);
  await db.delete(joinRequests);
  await db.delete(invitations);
  await db.delete(members);
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(verification);
  await db.delete(users);
  await db.delete(organizations);
});

afterAll(async () => {
  if (testState.containerName) {
    execSync(`docker rm -f ${testState.containerName}`, { stdio: "inherit" });
  }
});
