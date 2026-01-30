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
import { beforeEach } from "vitest";

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
