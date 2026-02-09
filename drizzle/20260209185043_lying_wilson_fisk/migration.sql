CREATE TYPE "organization_config_key" AS ENUM('description');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"published_at" timestamp,
	"published_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_config" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"key" "organization_config_key" NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_rsvps" (
	"user_id" text PRIMARY KEY,
	"shift_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" text PRIMARY KEY,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"start_timestamp" timestamp NOT NULL,
	"duration" interval NOT NULL,
	"rsvp_limit" integer
);
--> statement-breakpoint
CREATE INDEX "announcement_organizationId_idx" ON "announcements" ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_config_organizationId_key_idx" ON "organization_config" ("organization_id","key");--> statement-breakpoint
CREATE INDEX "shift_organizationId_idx" ON "shifts" ("organizationId");--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_published_by_id_users_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_config" ADD CONSTRAINT "organization_config_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "shift_rsvps" ADD CONSTRAINT "shift_rsvps_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "shift_rsvps" ADD CONSTRAINT "shift_rsvps_shift_id_shifts_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organizationId_organizations_id_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;