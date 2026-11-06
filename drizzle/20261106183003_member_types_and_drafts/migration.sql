CREATE TABLE "form_response_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" text NOT NULL,
	"form_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"answers" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "form_response_drafts_form_id_user_id_unique" UNIQUE("form_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "member_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"plural_label" text NOT NULL,
	"position" integer NOT NULL,
	"is_signup_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "member_types_organization_id_key_unique" UNIQUE("organization_id","key")
);
--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "member_type" SET DATA TYPE text USING "member_type"::text;--> statement-breakpoint
ALTER TABLE "organization_config" ALTER COLUMN "key" SET DATA TYPE text USING "key"::text;--> statement-breakpoint
CREATE UNIQUE INDEX "member_types_one_signup_default_idx" ON "member_types" ("organization_id") WHERE "is_signup_default";--> statement-breakpoint
ALTER TABLE "form_response_drafts" ADD CONSTRAINT "form_response_drafts_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_response_drafts" ADD CONSTRAINT "form_response_drafts_form_id_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_response_drafts" ADD CONSTRAINT "form_response_drafts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member_types" ADD CONSTRAINT "member_types_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
DROP TYPE "organization_config_key";