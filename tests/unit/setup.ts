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
  events,
  eventRsvps,
  media,
} from "@/lib/schema";
import { beforeAll, beforeEach, afterAll } from "vitest";
import { execSync } from "child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";

const id = randomUUID().split("-")[0];
const dbName = `testdb_${id}`;

process.env.NEXT_PUBLIC_BRANCH_NAME = dbName;
process.env.FILE_STORAGE_DIR = `/tmp/servicestart-media-test-${id}`;

// We need to configure env vars before importing later
let db: typeof import("@/lib/db").default;
let getDbUrl: typeof import("@/lib/db").getDbUrl;

beforeAll(async () => {
  getDbUrl = (await import("@/lib/db")).getDbUrl;

  // Start Postgres container
  execSync(`psql ${getDbUrl("postgres")} -c "CREATE DATABASE ${dbName};"`, {
    stdio: "inherit",
  });

  execSync(`pnpm run db:migrate`, {
    stdio: "inherit",
  });

  db = (await import("@/lib/db")).default;
});

beforeEach(async () => {
  if (!db) throw new Error("DB not initialized yet (beforeAll did not run)");

  // Wipe file storage directory
  const fileStorageDir = process.env.FILE_STORAGE_DIR;
  if (fileStorageDir) {
    if (existsSync(fileStorageDir)) {
      rmSync(fileStorageDir, { recursive: true, force: true });
    }
    mkdirSync(fileStorageDir, { recursive: true });
  }

  // Child tables first, then parent tables
  // Add line here when you create a new table
  await db.delete(media);
  await db.delete(eventRsvps);
  await db.delete(events);
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
  // Reset branch name because we can't drop the DB we're connected to
  process.env.NEXT_PUBLIC_BRANCH_NAME = "postgres";

  // Terminate connection so we can drop the DB
  db.$client.end();

  // Drop the test database
  execSync(`psql ${getDbUrl()} -c "DROP DATABASE ${dbName};"`, {
    stdio: "inherit",
  });
});
