import { defineRelations } from "drizzle-orm";
import { accounts, sessions, users, verifications } from "@/core/auth/schema";
import { organizationConfig } from "@/core/config/schema";
import { organizations } from "@/core/tenant/schema";
import {
  announcements,
  messageRecipients,
  messages,
  notifications,
} from "@/features/communications/schema";
import {
  eventHosts,
  eventRsvps,
  events,
  eventTags,
  shiftRSVPs,
  shifts,
  tags,
} from "@/features/events/schema";
import {
  formAnswers,
  formComponents,
  forms,
  formSubmissions,
  formUploads,
} from "@/features/forms/schema";
import { media } from "@/features/media/schema";
import {
  invitations,
  joinRequests,
  members,
  userOrganizations,
} from "@/features/membership/schema";

/*
 * Every context's tables, for Drizzle (drizzle.config.ts and the db client).
 * Each context owns its tables in its own schema.ts; this barrel only collects
 * them and defines the relations between them. Services import tables from
 * here.
 */
export * from "@/core/auth/schema";
export * from "@/core/config/schema";
export * from "@/core/tenant/schema";
export * from "@/features/communications/schema";
export * from "@/features/events/schema";
export * from "@/features/forms/schema";
export * from "@/features/media/schema";
export * from "@/features/membership/schema";

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
    userOrganizations,
    forms,
    formComponents,
    formSubmissions,
    formAnswers,
    formUploads,
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
      // Many-to-many: organizations for a user
      organizations: r.many.userOrganizations({
        from: r.users.id,
        to: r.userOrganizations.userId,
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
      // Many-to-many: users for an organization
      users: r.many.userOrganizations({
        from: r.organizations.id,
        to: r.userOrganizations.organizationId,
      }),
      forms: r.many.forms({
        from: r.organizations.id,
        to: r.forms.organizationId,
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
    forms: {
      organization: r.one.organizations({
        from: r.forms.organizationId,
        to: r.organizations.id,
      }),
      creator: r.one.users({
        from: r.forms.createdBy,
        to: r.users.id,
        optional: true,
      }),
      components: r.many.formComponents({
        from: r.forms.id,
        to: r.formComponents.formId,
      }),
      submissions: r.many.formSubmissions({
        from: r.forms.id,
        to: r.formSubmissions.formId,
      }),
      uploads: r.many.formUploads({
        from: r.forms.id,
        to: r.formUploads.formId,
      }),
    },
    formComponents: {
      form: r.one.forms({
        from: r.formComponents.formId,
        to: r.forms.id,
      }),
      answers: r.many.formAnswers({
        from: r.formComponents.id,
        to: r.formAnswers.componentId,
      }),
    },
    formSubmissions: {
      form: r.one.forms({
        from: r.formSubmissions.formId,
        to: r.forms.id,
      }),
      user: r.one.users({
        from: r.formSubmissions.userId,
        to: r.users.id,
        optional: true,
      }),
      answers: r.many.formAnswers({
        from: r.formSubmissions.id,
        to: r.formAnswers.submissionId,
      }),
    },
    formAnswers: {
      submission: r.one.formSubmissions({
        from: r.formAnswers.submissionId,
        to: r.formSubmissions.id,
      }),
      component: r.one.formComponents({
        from: r.formAnswers.componentId,
        to: r.formComponents.id,
      }),
    },
    formUploads: {
      form: r.one.forms({
        from: r.formUploads.formId,
        to: r.forms.id,
      }),
      uploader: r.one.users({
        from: r.formUploads.uploadedBy,
        to: r.users.id,
        optional: true,
      }),
    },
  }),
);

export const schema = {
  users,
  sessions,
  accounts,
  verifications,
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
  forms,
  formComponents,
  formSubmissions,
  formAnswers,
  formUploads,
};
