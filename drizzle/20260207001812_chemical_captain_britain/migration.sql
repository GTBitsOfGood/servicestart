CREATE TYPE "organization_config_key" AS ENUM('description');--> statement-breakpoint
CREATE TABLE "organization_config" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"key" "organization_config_key" NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "organization_config_orgId_key_idx" ON "organization_config" ("organization_id","key");--> statement-breakpoint
ALTER TABLE "organization_config" ADD CONSTRAINT "organization_config_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;