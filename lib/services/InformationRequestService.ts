import { randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import db from "@/lib/db";
import {
  FormStatus,
  forms,
  members,
  notifications,
  NotificationType,
} from "@/lib/schema";

const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The user isn't a member of the org, or the form isn't published in it. */
export class InformationRequestNotFoundError extends Error {
  constructor() {
    super("Member or form not found");
    this.name = "InformationRequestNotFoundError";
  }
}

/** The user was already asked for this form within the last 24 hours. */
export class RecentInformationRequestError extends Error {
  constructor() {
    super("This member was already asked for this form in the last 24 hours");
    this.name = "RecentInformationRequestError";
  }
}

/** What an information request's notification stores in its metadata. */
export type InformationRequestMetadata = {
  /** Where the notification links to. */
  link: string;
  /** The form's UUID. */
  informationRequestFormId: string;
  requestedBy: string;
};

/**
 * Asks a member to complete a published form by sending them an
 * ActionRequired notification. `formId` is the human-assigned key.
 */
async function request({
  organizationId,
  userId,
  formId,
  message,
  requestedBy,
  now = new Date(),
}: {
  organizationId: string;
  userId: string;
  formId: string;
  message?: string;
  requestedBy: string;
  now?: Date;
}) {
  return db.transaction(async (tx) => {
    // Locks the membership so two requests can't both pass the repeat check.
    const [membership] = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.userId, userId),
          eq(members.organizationId, organizationId),
        ),
      )
      .limit(1)
      .for("update");
    const [form] = await tx
      .select({ id: forms.id, formId: forms.formId, title: forms.title })
      .from(forms)
      .where(
        and(
          eq(forms.organizationId, organizationId),
          eq(forms.formId, formId),
          eq(forms.status, FormStatus.Published),
        ),
      )
      .limit(1);
    if (!membership || !form) throw new InformationRequestNotFoundError();

    const [recent] = await tx
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.organizationId, organizationId),
          eq(notifications.type, NotificationType.ActionRequired),
          sql`${notifications.metadata}->>'informationRequestFormId' = ${form.id}`,
          gt(
            notifications.createdAt,
            new Date(now.getTime() - REPEAT_WINDOW_MS),
          ),
        ),
      )
      .limit(1);
    if (recent) throw new RecentInformationRequestError();

    const metadata: InformationRequestMetadata = {
      link: `/forms/${form.formId}`,
      informationRequestFormId: form.id,
      requestedBy,
    };
    const [notification] = await tx
      .insert(notifications)
      .values({
        id: randomUUID(),
        userId,
        organizationId,
        type: NotificationType.ActionRequired,
        text: message
          ? `Please complete ${form.title}\n\n${message}`
          : `Please complete ${form.title}`,
        metadata,
        createdAt: now,
      })
      .returning({ id: notifications.id });
    return notification;
  });
}

export const InformationRequestService = {
  request,
};
