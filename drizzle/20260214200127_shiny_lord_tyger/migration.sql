CREATE TYPE "media_type" AS ENUM('image');--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"type" "media_type" NOT NULL,
	"alt_text" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "media_file_name_idx" ON "media" ("file_name");--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;