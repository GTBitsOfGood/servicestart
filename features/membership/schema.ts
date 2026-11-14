import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  pgEnum,
  pgTable,
  timestamp,
  index,
  integer,
  text,
  primaryKey,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/core/auth/schema";
import { organizations } from "@/core/tenant/schema";
import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";

// TypeScript enum for join request status values
export enum JoinRequestStatus {
  Pending = "pending",
  Approved = "approved",
  Denied = "denied",
}

// Array of enum values for use with pgEnum and Zod
export const JOIN_REQUEST_STATUS_VALUES = [
  JoinRequestStatus.Pending,
  JoinRequestStatus.Approved,
  JoinRequestStatus.Denied,
] as const;

export const joinRequestStatusEnum = pgEnum(
  "join_request_status",
  JOIN_REQUEST_STATUS_VALUES,
);

/**
 * The kinds of member an organization defines (#336). A member's type is one
 * of these rows' keys, in the member's own organization.
 */
export const memberTypes = pgTable(
  "member_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Stable slug for this type. It never changes once created: members,
    // form settings, and config rows refer to it.
    key: text("key").notNull(),
    label: text("label").notNull(),
    pluralLabel: text("plural_label").notNull(),
    position: integer("position").notNull(),
    // New signups get this type. At most one per organization.
    isSignupDefault: boolean("is_signup_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("member_types_organization_id_key_unique").on(
      table.organizationId,
      table.key,
    ),
    uniqueIndex("member_types_one_signup_default_idx")
      .on(table.organizationId)
      .where(sql`${table.isSignupDefault}`),
  ],
);

export const userOrganizations = pgTable(
  "user_organizations",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.organizationId] })],
);

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    // A member_types key in this organization. Only takes effect while
    // MemberTypesEnabled is on. Null for admins.
    memberType: text("member_type").$type<MemberTypeKey>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("member_userId_idx").on(table.userId),
    index("member_organizationId_idx").on(table.organizationId),
    // A member can only hold a type from their own organization. NO ACTION
    // (the default), not RESTRICT: deleting an organization cascades to both
    // tables, and NO ACTION checks only once the whole statement is done.
    foreignKey({
      name: "members_member_type_fkey",
      columns: [table.organizationId, table.memberType],
      foreignColumns: [memberTypes.organizationId, memberTypes.key],
    }),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [index("invitation_organizationId_idx").on(table.organizationId)],
);

export const joinRequests = pgTable(
  "join_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    status: joinRequestStatusEnum("status").notNull(),
    denialReason: text("denial_reason"),
  },
  (table) => [
    index("join_request_organizationId_idx").on(table.organizationId),
  ],
);

export const joinRequestHistory = pgTable("join_request_history", {
  id: text("id").primaryKey(),
  joinRequestId: text("join_request_id")
    .notNull()
    .references(() => joinRequests.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // "approved" | "denied" | "removed"
  resolvedByUserId: text("resolved_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  resolvedAt: timestamp("resolved_at").defaultNow().notNull(),
  denialReason: text("denial_reason"),
});
