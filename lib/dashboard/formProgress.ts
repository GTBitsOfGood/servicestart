import { cache } from "react";
import type { DashboardAudience } from "@/lib/dashboard/audience";
import {
  canEditSubmission,
  type FormAvailability,
} from "@/lib/forms/submission";
import { MemberType, OrganizationConfigKey } from "@/lib/schema";
import {
  FormProgressService,
  type MemberFormProgress,
} from "@/lib/services/FormProgressService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

export type FormTodoAction =
  | { kind: "open"; href: string }
  | { kind: "not_yet_open" }
  | { kind: "closed" };

export type FormTodoCard = {
  formUuid: string;
  formId: string;
  title: string;
  dueAt: string | null;
  pastDue: boolean;
  action: FormTodoAction;
};

export type FormCompletedCard = {
  formUuid: string;
  formId: string;
  title: string;
  submittedAt: Date;
  closesAt: string | null;
  canEdit: boolean;
};

export type FormProgressGauge = {
  done: number;
  total: number;
};

export type FormProgressSummary = {
  todo: FormTodoCard[];
  completed: FormCompletedCard[];
  gauge: FormProgressGauge;
};

export type FormProgressLoadResult =
  | { formsEnabled: false }
  | { formsEnabled: true; summary: FormProgressSummary };

const AUDIENCE_MEMBER_TYPE: Partial<Record<DashboardAudience, MemberType>> = {
  attendee: MemberType.Attendee,
  applicant: MemberType.Applicant,
};

export function memberTypeFromAudience(
  audience: DashboardAudience,
): MemberType | null {
  return AUDIENCE_MEMBER_TYPE[audience] ?? null;
}

function todoAction(form: MemberFormProgress["form"]): FormTodoAction {
  const availability: FormAvailability = form.availability;
  switch (availability) {
    case "open":
      return { kind: "open", href: `/forms/${form.formId}` };
    case "not_yet_open":
      return { kind: "not_yet_open" };
    case "closed":
      return { kind: "closed" };
    default: {
      const _exhaustive: never = availability;
      return _exhaustive;
    }
  }
}

function mapTodo(row: MemberFormProgress, now: Date): FormTodoCard {
  const { form } = row;
  const pastDue = form.dueAt !== null && now.getTime() > Date.parse(form.dueAt);
  return {
    formUuid: form.id,
    formId: form.formId,
    title: form.title,
    dueAt: form.dueAt,
    pastDue,
    action: todoAction(form),
  };
}

function mapCompleted(row: MemberFormProgress): FormCompletedCard {
  const { form, submission } = row;
  if (!submission) {
    throw new Error("completed row requires a submission");
  }
  return {
    formUuid: form.id,
    formId: form.formId,
    title: form.title,
    submittedAt: submission.submittedAt,
    closesAt: form.closesAt,
    canEdit: canEditSubmission({
      availability: form.availability,
      reviewStatus: submission.reviewStatus,
    }),
  };
}

/** Pure view model for the three forms dashboard widgets. */
export function summarizeFormProgress(
  rows: MemberFormProgress[],
  now: Date,
): FormProgressSummary {
  const todo: FormTodoCard[] = [];
  const completed: FormCompletedCard[] = [];
  let gaugeDone = 0;
  let gaugeTotal = 0;

  for (const row of rows) {
    if (row.submission) {
      completed.push(mapCompleted(row));
    }
    if (row.required) {
      gaugeTotal += 1;
      if (row.submission) {
        gaugeDone += 1;
      } else {
        todo.push(mapTodo(row, now));
      }
    }
  }

  return {
    todo,
    completed,
    gauge: { done: gaugeDone, total: gaugeTotal },
  };
}

// Three form widgets share one page; cache() dedupes config + listForMember per request.
export const loadFormProgress = cache(
  async (
    organizationId: string,
    userId: string,
    audience: DashboardAudience,
  ): Promise<FormProgressLoadResult> => {
    const config = await OrganizationConfigService.getConfig(organizationId, [
      OrganizationConfigKey.FormsEnabled,
    ]);
    if (config[OrganizationConfigKey.FormsEnabled] !== true) {
      return { formsEnabled: false };
    }

    const rows = await FormProgressService.listForMember(
      organizationId,
      userId,
      memberTypeFromAudience(audience),
    );

    return {
      formsEnabled: true,
      summary: summarizeFormProgress(rows, new Date()),
    };
  },
);
