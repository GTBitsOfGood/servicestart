import { pgTable, timestamp, text } from "drizzle-orm/pg-core";

// The tenant. Every user-facing row belongs to one organization.

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  phoneNumber: text("phone_number"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
