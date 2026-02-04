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
import { beforeEach, beforeAll } from "vitest";
import { execSync } from "child_process";

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
  const dbName = `testdb_${id}`;
  const containerName = `test-db-${id}`;

  // Set environment variable
  const dbUrl = `postgresql://postgres:postgres@localhost:${port}/${dbName}`;
  process.env.DB_URL = dbUrl;

  // Launch a Postgres container
  execSync(
    `docker run --name ${containerName} -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=${dbName} -p ${port}:5432 -d postgres:15`,
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
