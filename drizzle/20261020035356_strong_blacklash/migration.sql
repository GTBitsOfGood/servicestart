CREATE TYPE "submission_review_status" AS ENUM('pending', 'under_review', 'accepted', 'rejected');--> statement-breakpoint
ALTER TYPE "form_component_type" ADD VALUE 'single_choice';--> statement-breakpoint
ALTER TYPE "form_component_type" ADD VALUE 'checkboxes';--> statement-breakpoint
ALTER TYPE "form_component_type" ADD VALUE 'dropdown';--> statement-breakpoint
ALTER TYPE "form_component_type" ADD VALUE 'date';--> statement-breakpoint
ALTER TYPE "form_component_type" ADD VALUE 'yes_no';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'applicant_dashboard_layout';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'attendee_dashboard_layout';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'dashboard_header';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'navbar_config';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'organization_footer';--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "review_status" "submission_review_status" DEFAULT 'pending'::"submission_review_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "review_status_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "review_status_updated_by" text;--> statement-breakpoint
CREATE INDEX "form_submissions_organization_id_user_id_idx" ON "form_submissions" ("organization_id","user_id");--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_review_status_updated_by_users_id_fkey" FOREIGN KEY ("review_status_updated_by") REFERENCES "users"("id") ON DELETE SET NULL;