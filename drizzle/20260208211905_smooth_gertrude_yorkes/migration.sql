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
DROP INDEX "organization_config_orgId_key_idx";--> statement-breakpoint
CREATE INDEX "announcement_organizationId_idx" ON "announcements" ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_config_organizationId_key_idx" ON "organization_config" ("organization_id","key");--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_published_by_id_users_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE CASCADE;