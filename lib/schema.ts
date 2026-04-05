import { defineRelations, sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  timestamp,
  boolean,
  index,
  text,
  interval,
  primaryKey,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

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

//TypeScript enum for org config key values
export enum OrganizationConfigKey {
  Description = "description",
  PrimaryColor = "primary_color",
  SecondaryColor = "secondary_color",
  Tagline = "tagline",
  NavbarVariant = "navbar_variant",
  NavbarColor = "navbar_color",
  MembersPageEnabled = "members_page_enabled",
  LogoUrl = "logo_url",
  AdminDashboardLayout = "admin_dashboard_layout",
  DashboardLayout = "dashboard_layout",
}

export enum EventVisibility {
  Public = "public",
  Member = "member-only",
}

export const eventVisibilityEnum = pgEnum(
  "visibility",
  Object.values(EventVisibility) as [string, ...string[]],
);

export type ToggleableOrganizationFeature = Extract<
  OrganizationConfigKey,
  OrganizationConfigKey.MembersPageEnabled
>;

// Array of enum values for use with pgEnum and Zod
export const ORGANIZATION_CONFIG_KEY_VALUES = Object.values(
  OrganizationConfigKey,
) as unknown as readonly [string, ...string[]];

export const organizationConfigKeyEnum = pgEnum(
  "organization_config_key",
  ORGANIZATION_CONFIG_KEY_VALUES,
);

// Enum for media type values
export enum MediaType {
  Image = "image",
}

export const MEDIA_TYPE_VALUES = Object.values(
  MediaType,
) as unknown as readonly [string, ...string[]];
export const mediaTypeEnum = pgEnum("media_type", MEDIA_TYPE_VALUES);

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

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  phoneNumber: text("phone_number"),
  displayName: text("display_name"),
  pronouns: text("pronouns"),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id").references(
      () => organizations.id,
    ),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

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
  },
  (table) => [
    index("join_request_organizationId_idx").on(table.organizationId),
  ],
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

export const shiftRSVPs = pgTable("shift_rsvps", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  shiftId: text("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "cascade" }),
});

export const organizationConfig = pgTable(
  "organization_config",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: organizationConfigKeyEnum("key").notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    index("organization_config_organizationId_key_idx").on(
      table.organizationId,
      table.key,
    ),
  ],
);

export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    fileName: text("file_name").notNull(),
    type: mediaTypeEnum("type").notNull(),
    altText: text("alt_text").notNull(),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (table) => [index("media_fileName_idx").on(table.fileName)],
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
  },
  (table) => [
    index("notification_userId_organizationId_idx").on(
      table.userId,
      table.organizationId,
    ),
  ],
);

export const relations = defineRelations(
  {
    users,
    sessions,
    accounts,
    organizations,
    members,
    invitations,
    joinRequests,
    events,
    tags,
    eventTags,
    eventHosts,
    eventRsvps,
    announcements,
    shifts,
    shiftRSVPs,
    organizationConfig,
    media,
    messages,
    messageRecipients,
    notifications,
  },
  (r) => ({
    users: {
      sessions: r.many.sessions({
        from: r.users.id,
        to: r.sessions.userId,
      }),
      accounts: r.many.accounts({
        from: r.users.id,
        to: r.accounts.userId,
      }),
      rsvps: r.many.shiftRSVPs({
        from: r.users.id,
        to: r.shiftRSVPs.userId,
      }),
      hosts: r.many.eventHosts({
        from: r.users.id,
        to: r.eventHosts.userId,
      }),
      sentMessages: r.many.messages({
        from: r.users.id,
        to: r.messages.senderId,
      }),
      messageRecipients: r.many.messageRecipients({
        from: r.users.id,
        to: r.messageRecipients.userId,
      }),
      notifications: r.many.notifications({
        from: r.users.id,
        to: r.notifications.userId,
      }),
    },
    sessions: {
      organizations: r.one.organizations({
        from: r.sessions.activeOrganizationId,
        to: r.organizations.id,
      }),
    },
    organizations: {
      shifts: r.many.shifts({
        from: r.organizations.id,
        to: r.shifts.organizationId,
      }),
      media: r.many.media({
        from: r.organizations.id,
        to: r.media.organizationId,
      }),
      messages: r.many.messages({
        from: r.organizations.id,
        to: r.messages.organizationId,
      }),
      notifications: r.many.notifications({
        from: r.organizations.id,
        to: r.notifications.organizationId,
      }),
    },
    members: {
      users: r.one.users({
        from: r.members.userId,
        to: r.users.id,
      }),
      organizations: r.one.organizations({
        from: r.members.organizationId,
        to: r.organizations.id,
      }),
    },
    invitations: {
      organizations: r.one.organizations({
        from: r.invitations.organizationId,
        to: r.organizations.id,
      }),
      inviter: r.one.users({
        from: r.invitations.inviterId,
        to: r.users.id,
      }),
    },
    joinRequests: {
      users: r.one.users({
        from: r.joinRequests.userId,
        to: r.users.id,
      }),
      organizations: r.one.organizations({
        from: r.joinRequests.organizationId,
        to: r.organizations.id,
      }),
    },
    events: {
      organizations: r.one.organizations({
        from: r.events.organizationId,
        to: r.organizations.id,
      }),
      rsvps: r.many.eventRsvps({
        from: r.events.id,
        to: r.eventRsvps.eventId,
      }),
      shifts: r.many.shifts({
        from: r.events.id,
        to: r.shifts.eventId,
      }),
      hosts: r.many.eventHosts({
        from: r.events.id,
        to: r.eventHosts.eventId,
      }),
      eventTags: r.many.eventTags({
        from: r.events.id,
        to: r.eventTags.eventId,
      }),
    },
    eventRsvps: {
      user: r.one.users({
        from: r.eventRsvps.userId,
        to: r.users.id,
      }),
      event: r.one.events({
        from: r.eventRsvps.eventId,
        to: r.events.id,
      }),
    },
    tags: {
      organizations: r.one.organizations({
        from: r.tags.organizationId,
        to: r.organizations.id,
      }),
    },
    eventTags: {
      event: r.many.events({
        from: r.eventTags.eventId,
        to: r.events.id,
      }),
    },
    announcements: {
      organizations: r.one.organizations({
        from: r.announcements.organizationId,
        to: r.organizations.id,
      }),
      users: r.one.users({
        from: r.announcements.publishedById,
        to: r.users.id,
        optional: true,
      }),
    },
    shifts: {
      organizations: r.one.organizations({
        from: r.shifts.organizationId,
        to: r.organizations.id,
      }),
      event: r.one.events({
        from: r.shifts.eventId,
        to: r.events.id,
      }),
      rsvps: r.many.shiftRSVPs({
        from: r.shifts.id,
        to: r.shiftRSVPs.shiftId,
      }),
    },
    shiftRSVPs: {
      users: r.one.users({
        from: r.shiftRSVPs.userId,
        to: r.users.id,
      }),
      shifts: r.one.shifts({
        from: r.shiftRSVPs.shiftId,
        to: r.shifts.id,
      }),
    },
    organizationConfig: {
      organizations: r.one.organizations({
        from: r.organizationConfig.organizationId,
        to: r.organizations.id,
      }),
    },
    media: {
      organizations: r.one.organizations({
        from: r.media.organizationId,
        to: r.organizations.id,
      }),
    },
    messages: {
      organizations: r.one.organizations({
        from: r.messages.organizationId,
        to: r.organizations.id,
      }),
      sender: r.one.users({
        from: r.messages.senderId,
        to: r.users.id,
      }),
      recipients: r.many.messageRecipients({
        from: r.messages.id,
        to: r.messageRecipients.messageId,
      }),
    },
    messageRecipients: {
      message: r.one.messages({
        from: r.messageRecipients.messageId,
        to: r.messages.id,
      }),
      user: r.one.users({
        from: r.messageRecipients.userId,
        to: r.users.id,
      }),
    },
    notifications: {
      users: r.one.users({
        from: r.notifications.userId,
        to: r.users.id,
      }),
      organizations: r.one.organizations({
        from: r.notifications.organizationId,
        to: r.organizations.id,
      }),
    },
  }),
);

export const schema = {
  users,
  sessions,
  accounts,
  verification,
  organizations,
  members,
  invitations,
  joinRequests,
  events,
  eventRsvps,
  eventHosts,
  tags,
  eventTags,
  announcements,
  shifts,
  shiftRSVPs,
  organizationConfig,
  media,
  messages,
  messageRecipients,
  notifications,
};
