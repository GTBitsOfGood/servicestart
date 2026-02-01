CREATE TYPE "join_request_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TABLE "join_requests" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" "join_request_status" NOT NULL
);
--> statement-breakpoint
CREATE INDEX "join_request_organizationId_idx" ON "join_requests" ("organization_id");--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;