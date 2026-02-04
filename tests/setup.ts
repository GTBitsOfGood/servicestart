import db from "@/lib/db";
import {
  accounts,
  invitations,
  joinRequests,
  members,
  organizations,
  sessions,
  users,
  verification,
} from "@/lib/schema";
import { beforeEach, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { randomUUID } from "node:crypto";
import { testState } from "./testState";

beforeEach(async () => {
  // Wipe DB before each test - delete in order to respect FK constraints
  // Child tables first, then parent tables
  // Add line here when you create a new table
  await db.delete(joinRequests);
  await db.delete(invitations);
  await db.delete(members);
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(verification);
  await db.delete(users);
  await db.delete(organizations);
});

beforeAll(async () => {
  // Create a random DB name and port
  const id = randomUUID().split("-")[0]; // e.g. 'f3a9c2'
  const port = 5433 + Math.floor(Math.random() * 100); // Avoid port collisions
  testState.dbName = `testdb_${id}`;
  testState.containerName = `test-db-${id}`;

  // Set environment variable
  const dbUrl = `postgresql://postgres:postgres@localhost:${port}/${testState.dbName}`;
  process.env.DB_URL = dbUrl;

  // Launch a Postgres container
  execSync(
    `docker run --name ${testState.containerName} -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=${testState.dbName} -p ${port}:5432 -d postgres:15`,
    { stdio: "inherit" },
  );

  // Wait a few seconds for the DB to be ready
  await new Promise((res) => setTimeout(res, 5000));

  // Run migration
  execSync(`pnpm db:migrate`, {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
    },
  });
});

afterAll(async () => {
  if (testState.containerName) {
    execSync(`docker rm -f ${testState.containerName}`, { stdio: "inherit" });
  }
});
