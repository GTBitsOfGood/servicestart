CREATE TYPE "form_component_type" AS ENUM('short_text', 'long_text', 'email', 'phone', 'number', 'image', 'section_header');--> statement-breakpoint
CREATE TYPE "form_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TYPE "member_type" AS ENUM('applicant', 'attendee');--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'forms_enabled';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'member_types_enabled';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'auto_approve_signups';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'background_color';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'text_color';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'display_font';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'heading_font';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'body_font';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'corner_style';--> statement-breakpoint
CREATE TABLE "form_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"form_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "form_answers_submission_id_component_id_unique" UNIQUE("submission_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "form_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"form_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"type" "form_component_type" NOT NULL,
	"label" text NOT NULL,
	"help_text" text,
	"required" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"config" jsonb NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "form_components_id_form_id_unique" UNIQUE("id","form_id")
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"form_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "form_submissions_id_form_id_unique" UNIQUE("id","form_id")
);
--> statement-breakpoint
CREATE TABLE "form_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" text NOT NULL,
	"form_id" uuid NOT NULL,
	"uploaded_by" text,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" text NOT NULL,
	"form_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "form_status" DEFAULT 'draft'::"form_status" NOT NULL,
	"settings" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "forms_organization_id_form_id_unique" UNIQUE("organization_id","form_id")
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "member_type" "member_type";--> statement-breakpoint
CREATE INDEX "form_components_form_id_position_idx" ON "form_components" ("form_id","position");--> statement-breakpoint
CREATE INDEX "form_submissions_form_id_user_id_idx" ON "form_submissions" ("form_id","user_id");--> statement-breakpoint
CREATE INDEX "form_uploads_form_id_idx" ON "form_uploads" ("form_id");--> statement-breakpoint
ALTER TABLE "form_answers" ADD CONSTRAINT "form_answers_submission_fkey" FOREIGN KEY ("submission_id","form_id") REFERENCES "form_submissions"("id","form_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_answers" ADD CONSTRAINT "form_answers_component_fkey" FOREIGN KEY ("component_id","form_id") REFERENCES "form_components"("id","form_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_components" ADD CONSTRAINT "form_components_form_id_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_components" ADD CONSTRAINT "form_components_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "form_uploads" ADD CONSTRAINT "form_uploads_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_uploads" ADD CONSTRAINT "form_uploads_form_id_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_uploads" ADD CONSTRAINT "form_uploads_uploaded_by_users_id_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;