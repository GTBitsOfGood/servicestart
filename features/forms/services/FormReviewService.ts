import { and, asc, count, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";
import db from "@/core/db";
import {
  forms,
  formSubmissions,
  members,
  users,
  MemberType,
  SubmissionReviewStatus,
} from "@/core/db/schema";
import { getAcceptedMemberType } from "@/features/forms/lib/schema";
import { REVIEW_STATUS_LABELS } from "@/features/forms/lib/review";
import { FormService } from "@/features/forms/services/FormService";
import { MembersService } from "@/features/membership/server";
import { NotificationService } from "@/features/communications/server";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ReviewInput = {
  organizationId: string;
  submissionIds: string[];
  status: SubmissionReviewStatus;
};

export class SubmissionNotFoundError extends Error {
  constructor() {
    super("Submission not found");
    this.name = "SubmissionNotFoundError";
  }
}

export type ReviewStatusChange = {
  id: string;
  /** The form's UUID, not its public key. */
  formId: string;
  userId: string | null;
  previousStatus: SubmissionReviewStatus;
  reviewStatus: SubmissionReviewStatus;
  changed: boolean;
};

async function listResponses(
  organizationId: string,
  formId: string,
  {
    status,
    search,
    limit,
    offset,
  }: {
    status?: SubmissionReviewStatus;
    search?: string;
    limit: number;
    offset: number;
  },
) {
  const form = await FormService.get(organizationId, formId);
  // Escape LIKE metacharacters so search is a literal substring.
  const pattern = `%${(search ?? "").trim().replace(/[\\%_]/g, "\\$&")}%`;
  const scope = and(
    eq(formSubmissions.organizationId, organizationId),
    eq(formSubmissions.formId, form.id),
    search?.trim()
      ? or(ilike(users.name, pattern), ilike(users.email, pattern))
      : undefined,
  );
  const [rows, grouped] = await Promise.all([
    db
      .select({
        id: formSubmissions.id,
        userId: formSubmissions.userId,
        name: users.name,
        email: users.email,
        submittedAt: formSubmissions.submittedAt,
        updatedAt: formSubmissions.updatedAt,
        reviewStatus: formSubmissions.reviewStatus,
      })
      .from(formSubmissions)
      .leftJoin(users, eq(users.id, formSubmissions.userId))
      .where(
        and(
          scope,
          status ? eq(formSubmissions.reviewStatus, status) : undefined,
        ),
      )
      .orderBy(desc(formSubmissions.submittedAt), asc(formSubmissions.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ status: formSubmissions.reviewStatus, count: count() })
      .from(formSubmissions)
      .leftJoin(users, eq(users.id, formSubmissions.userId))
      .where(scope)
      .groupBy(formSubmissions.reviewStatus),
  ]);
  const counts = Object.fromEntries(
    Object.values(SubmissionReviewStatus).map((value) => [value, 0]),
  ) as Record<SubmissionReviewStatus, number>;
  for (const group of grouped) counts[group.status] = Number(group.count);
  const total = status
    ? counts[status]
    : Object.values(counts).reduce((sum, value) => sum + value, 0);
  return { rows, total, counts };
}

async function currentSubmissions(tx: Transaction, input: ReviewInput) {
  const ids = [...new Set(input.submissionIds)].sort();
  if (!ids.length) return [];
  const rows = await tx
    .select({
      id: formSubmissions.id,
      formId: formSubmissions.formId,
      userId: formSubmissions.userId,
      reviewStatus: formSubmissions.reviewStatus,
    })
    .from(formSubmissions)
    .where(
      and(
        inArray(formSubmissions.id, ids),
        eq(formSubmissions.organizationId, input.organizationId),
      ),
    )
    .orderBy(asc(formSubmissions.id))
    .for("update");
  if (rows.length !== ids.length) throw new SubmissionNotFoundError();
  return rows;
}

/** Shared by preview and execution; all writes still recheck eligibility. */
async function effectsFor(
  tx: Transaction,
  input: ReviewInput,
  current: Awaited<ReturnType<typeof currentSubmissions>>,
) {
  const changed = current.filter((row) => row.reviewStatus !== input.status);
  const userIds = [
    ...new Set(changed.flatMap((row) => (row.userId ? [row.userId] : []))),
  ];
  const formIds = [...new Set(changed.map((row) => row.formId))];
  const formRows = formIds.length
    ? await tx
        .select()
        .from(forms)
        .where(
          and(
            eq(forms.organizationId, input.organizationId),
            inArray(forms.id, formIds),
          ),
        )
    : [];
  const formMap = new Map(formRows.map((form) => [form.id, form]));
  const membershipRows = userIds.length
    ? await tx
        .select()
        .from(members)
        .where(
          and(
            eq(members.organizationId, input.organizationId),
            inArray(members.userId, userIds),
          ),
        )
        .orderBy(asc(members.id))
        .for("update")
    : [];
  const enabled =
    input.status === SubmissionReviewStatus.Accepted &&
    (await OrganizationConfigService.getMemberTypesEnabled(
      input.organizationId,
    ));
  const memberChanges = new Map<string, MemberType>();
  for (const row of changed) {
    const form = formMap.get(row.formId);
    const target = form ? getAcceptedMemberType(form.settings) : null;
    const memberships = membershipRows.filter(
      (member) => member.userId === row.userId,
    );
    if (
      enabled &&
      row.userId &&
      target &&
      memberships.length &&
      !memberships.some((member) => MembersService.isAdminOrOwner(member.role))
    ) {
      memberChanges.set(row.userId, target);
    }
  }
  const actualMemberChanges = new Map(
    [...memberChanges].filter(([userId, target]) =>
      membershipRows.some(
        (member) => member.userId === userId && member.memberType !== target,
      ),
    ),
  );
  const decisions =
    input.status === SubmissionReviewStatus.Accepted ||
    input.status === SubmissionReviewStatus.Rejected
      ? changed.filter((row) => row.userId !== null)
      : [];
  return { changed, formMap, memberChanges: actualMemberChanges, decisions };
}

async function previewStatusChange(input: ReviewInput) {
  return db.transaction(async (tx) => {
    const effects = await effectsFor(
      tx,
      input,
      await currentSubmissions(tx, input),
    );
    return {
      changed: effects.changed.length,
      notified: new Set(effects.decisions.map((row) => row.userId)).size,
      memberTypesChanged: effects.memberChanges.size,
    };
  });
}

/**
 * Changes nothing if any ID is missing or belongs to another organization.
 * Status, membership, and in-app notifications commit together. Leaving
 * Accepted never restores the previous member type. A genuine later decision
 * transition notifies again; repeating the current status does nothing.
 */
async function setReviewStatus(
  input: ReviewInput & { actorId: string },
): Promise<ReviewStatusChange[]> {
  if (!input.submissionIds.length) return [];
  return db.transaction(async (tx) => {
    const current = await currentSubmissions(tx, input);
    const effects = await effectsFor(tx, input, current);
    await tx
      .update(formSubmissions)
      .set({
        reviewStatus: input.status,
        reviewStatusUpdatedAt: new Date(),
        reviewStatusUpdatedBy: input.actorId,
      })
      .where(
        and(
          eq(formSubmissions.organizationId, input.organizationId),
          inArray(
            formSubmissions.id,
            current.map((row) => row.id),
          ),
          ne(formSubmissions.reviewStatus, input.status),
        ),
      );
    for (const [userId, target] of effects.memberChanges) {
      const result = await MembersService.setMemberTypes(
        input.organizationId,
        [userId],
        target,
        tx,
      );
      if ("error" in result)
        throw new Error("Unable to update submitter membership");
    }
    for (const row of effects.decisions) {
      const title = effects.formMap.get(row.formId)?.title ?? "form";
      await NotificationService.notify(
        row.userId!,
        input.organizationId,
        `Your response to “${title}” has been ${REVIEW_STATUS_LABELS[input.status].toLowerCase()}.`,
        { kind: "form_review", href: "/", submissionId: row.id },
        tx,
      );
    }
    return current.map((row) => ({
      id: row.id,
      formId: row.formId,
      userId: row.userId,
      previousStatus: row.reviewStatus,
      reviewStatus: input.status,
      changed: row.reviewStatus !== input.status,
    }));
  });
}

export const FormReviewService = {
  listResponses,
  previewStatusChange,
  setReviewStatus,
};
