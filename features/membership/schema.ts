import {
  pgEnum,
  pgTable,
  timestamp,
  index,
  text,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "@/core/auth/schema";
import { organizations } from "@/core/tenant/schema";

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

export enum MemberType {
  Applicant = "applicant",
  Attendee = "attendee",
}

export const MEMBER_TYPE_VALUES = Object.values(MemberType) as [
  MemberType,
  ...MemberType[],
];

export const memberTypeEnum = pgEnum("member_type", MEMBER_TYPE_VALUES);

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
    // Only takes effect while MemberTypesEnabled is on. Null for admins.
    memberType: memberTypeEnum("member_type"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("member_userId_idx").on(table.userId),
    index("member_organizationId_idx").on(table.organizationId),
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
