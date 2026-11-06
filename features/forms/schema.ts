import {
  pgEnum,
  pgTable,
  timestamp,
  boolean,
  index,
  text,
  integer,
  jsonb,
  unique,
  uuid,
  foreignKey,
} from "drizzle-orm/pg-core";
import { users } from "@/core/auth/schema";
import { parsedJsonb } from "@/core/db/columns";
import { organizations } from "@/core/tenant/schema";
import type {
  FormAnswerValue,
  FormComponentConfigValue,
  FormSettings,
} from "@/features/forms/lib/schema";

export enum FormStatus {
  Draft = "draft",
  Published = "published",
  Closed = "closed",
}

export const FORM_STATUS_VALUES = Object.values(FormStatus) as [
  FormStatus,
  ...FormStatus[],
];

export const formStatusEnum = pgEnum("form_status", FORM_STATUS_VALUES);

// Each value needs a config schema and an answer schema in lib/schema.ts,
// validation in lib/submission.ts (both in features/forms/), plus an entry in
// the builder (#321) and renderer (#299) registries.
export enum FormComponentType {
  ShortText = "short_text",
  LongText = "long_text",
  Email = "email",
  Phone = "phone",
  Number = "number",
  Image = "image",
  SectionHeader = "section_header",
  SingleChoice = "single_choice",
  Checkboxes = "checkboxes",
  Dropdown = "dropdown",
  Date = "date",
  YesNo = "yes_no",
}

export const FORM_COMPONENT_TYPE_VALUES = Object.values(FormComponentType) as [
  FormComponentType,
  ...FormComponentType[],
];

export const formComponentTypeEnum = pgEnum(
  "form_component_type",
  FORM_COMPONENT_TYPE_VALUES,
);

// Where an admin's review of a submission stands. Every submission starts as
// pending; admins move it along on the responses pages (#316, #317).
export enum SubmissionReviewStatus {
  Pending = "pending",
  UnderReview = "under_review",
  Accepted = "accepted",
  Rejected = "rejected",
}

export const SUBMISSION_REVIEW_STATUS_VALUES = Object.values(
  SubmissionReviewStatus,
) as [SubmissionReviewStatus, ...SubmissionReviewStatus[]];

export const submissionReviewStatusEnum = pgEnum(
  "submission_review_status",
  SUBMISSION_REVIEW_STATUS_VALUES,
);

export const forms = pgTable(
  "forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Human-assigned key used in URLs (e.g. "camp-application-2027"), unique
    // per organization. Child tables reference the UUID `id`, not this.
    formId: text("form_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: formStatusEnum("status").default(FormStatus.Draft).notNull(),
    settings: jsonb("settings").$type<FormSettings>().notNull(),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique("forms_organization_id_form_id_unique").on(
      table.organizationId,
      table.formId,
    ),
  ],
);

export const formComponents = pgTable(
  "form_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // References forms.id (the UUID), not forms.formId.
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: formComponentTypeEnum("type").notNull(),
    label: text("label").notNull(),
    helpText: text("help_text"),
    required: boolean("required").default(false).notNull(),
    position: integer("position").notNull(),
    // Shape depends on `type`; validate with FORM_COMPONENT_CONFIG_SCHEMAS.
    config: jsonb("config").$type<FormComponentConfigValue>().notNull(),
    // Unused for now: questions are locked once a form is published.
    archivedAt: timestamp("archived_at"),
  },
  (table) => [
    index("form_components_form_id_position_idx").on(
      table.formId,
      table.position,
    ),
    // Lets form_answers check that its component is on the same form.
    unique("form_components_id_form_id_unique").on(table.id, table.formId),
  ],
);

export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // References forms.id (the UUID), not forms.formId.
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Null for anonymous submissions to forms that don't require login, and
    // once the submitter's account is deleted (the org keeps the response).
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    // Null until the submitter edits their answers (#319).
    updatedAt: timestamp("updated_at"),
    reviewStatus: submissionReviewStatusEnum("review_status")
      .default(SubmissionReviewStatus.Pending)
      .notNull(),
    reviewStatusUpdatedAt: timestamp("review_status_updated_at"),
    reviewStatusUpdatedBy: text("review_status_updated_by").references(
      () => users.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    index("form_submissions_form_id_user_id_idx").on(
      table.formId,
      table.userId,
    ),
    // A member's submissions across an org's forms (FormProgressService).
    index("form_submissions_organization_id_user_id_idx").on(
      table.organizationId,
      table.userId,
    ),
    // Lets form_answers check that its submission is on the same form.
    unique("form_submissions_id_form_id_unique").on(table.id, table.formId),
  ],
);

export const formAnswers = pgTable(
  "form_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // References forms.id (the UUID), not forms.formId. The foreign keys below
    // require the submission and the component to be on this form.
    formId: uuid("form_id").notNull(),
    submissionId: uuid("submission_id").notNull(),
    componentId: uuid("component_id").notNull(),
    // Shape depends on the component's type; see FORM_ANSWER_VALUE_SCHEMAS.
    value: parsedJsonb<FormAnswerValue>("value").notNull(),
  },
  (table) => [
    unique("form_answers_submission_id_component_id_unique").on(
      table.submissionId,
      table.componentId,
    ),
    foreignKey({
      name: "form_answers_submission_fkey",
      columns: [table.submissionId, table.formId],
      foreignColumns: [formSubmissions.id, formSubmissions.formId],
    }).onDelete("cascade"),
    // Questions are only deleted from drafts, which have no answers.
    foreignKey({
      name: "form_answers_component_fkey",
      columns: [table.componentId, table.formId],
      foreignColumns: [formComponents.id, formComponents.formId],
    }).onDelete("cascade"),
  ],
);

// Files uploaded to a form (headshots). Kept apart from `media` so they never
// appear in the media library.
export const formUploads = pgTable(
  "form_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // References forms.id (the UUID), not forms.formId.
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    // Null for anonymous uploads to forms that don't require login, and once
    // the uploader's account is deleted.
    uploadedBy: text("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("form_uploads_form_id_idx").on(table.formId)],
);
