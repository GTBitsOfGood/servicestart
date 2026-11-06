import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  timestamp,
  boolean,
  index,
  text,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "@/core/auth/schema";
import { organizations } from "@/core/tenant/schema";

export enum NotificationType {
  General = "general",
  Announcement = "announcement",
  ActionRequired = "action_required",
  Reminder = "reminder",
  Members = "members",
  ScheduleUpdate = "schedule_update",
  Confirmation = "confirmation",
}

export const NOTIFICATION_TYPE_VALUES = Object.values(
  NotificationType,
) as unknown as readonly [string, ...string[]];

export const notificationTypeEnum = pgEnum(
  "notification_type",
  NOTIFICATION_TYPE_VALUES,
);

export const announcements = pgTable(
  "announcements",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    content: jsonb("content").notNull(),
    subject: text("subject").notNull(),
    template: boolean("template").default(false),
    // when this is null, it means that the announcement is not published (e.g. its a draft)
    publishedAt: timestamp("published_at"),
    publishedById: text("published_by_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("announcement_organizationId_idx").on(table.organizationId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .default(sql`md5(random()::text || clock_timestamp()::text)`),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    body: jsonb("body").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (table) => [index("messages_organizationId_idx").on(table.organizationId)],
);

export const messageRecipients = pgTable(
  "message_recipients",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    {
      pk: primaryKey({ columns: [table.messageId, table.userId] }),
    },
    index("message_recipients_userId_idx").on(table.userId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    read: boolean("read").default(false).notNull(),
    type: notificationTypeEnum("type")
      .default(NotificationType.General)
      .notNull(),
    text: text("text").notNull(),
    metadata: jsonb("metadata"), // Used for linking a join request to the notification for admin approval/denial
  },
  (table) => [
    index("notification_userId_organizationId_idx").on(
      table.userId,
      table.organizationId,
    ),
  ],
);
