import {
  pgEnum,
  pgTable,
  timestamp,
  index,
  text,
  interval,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";
import { users } from "@/core/auth/schema";
import { organizations } from "@/core/tenant/schema";

export enum EventVisibility {
  Public = "public",
  Member = "member-only",
}

export const eventVisibilityEnum = pgEnum(
  "visibility",
  Object.values(EventVisibility) as [string, ...string[]],
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    location: text("location").notNull(),
    description: text("description"),
    startTimestamp: timestamp("start_timestamp"),
    duration: interval("duration"),
    rsvpLimit: integer("rsvp_limit"),
    rsvpDeadline: timestamp("rsvp_deadline"),
    visibility: eventVisibilityEnum("visibility").notNull(),
    accessibilityNotes: text("accessibility_notes"),
    links: text("links").array(),
    coverImageUrl: text("cover_image_url"),
    publishedAt: timestamp("published_at"),
    publishedById: text("published_by_id").references(() => users.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [index("events_organizationId_idx").on(table.organizationId)],
);

export const eventHosts = pgTable(
  "event_hosts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
  },
  (table) => [
    {
      pk: primaryKey({ columns: [table.userId, table.eventId] }),
    },
  ],
);

export const tags = pgTable("tags", {
  tagId: text("tag_id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
});

export const eventTags = pgTable(
  "event_tags",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.tagId, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.tagId] })],
);

export const eventRsvps = pgTable(
  "event_rsvps",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
  },
  (table) => [
    {
      pk: primaryKey({ columns: [table.userId, table.eventId] }),
    },
  ],
);

export const shifts = pgTable(
  "shifts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    startTimestamp: timestamp("start_timestamp").notNull(),
    duration: interval("duration").notNull(),
    rsvpLimit: integer("rsvp_limit"),
    eventId: text("eventId")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("shift_organizationId_idx").on(table.organizationId),
    index("shift_eventId_idx").on(table.eventId),
  ],
);

export const shiftRSVPs = pgTable(
  "shift_rsvps",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shiftId: text("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.shiftId, table.userId] })],
);
