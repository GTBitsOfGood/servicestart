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
CREATE INDEX "shift_organizationId_idx" ON "shifts" ("organizationId");--> statement-breakpoint
ALTER TABLE "shift_rsvps" ADD CONSTRAINT "shift_rsvps_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "shift_rsvps" ADD CONSTRAINT "shift_rsvps_shift_id_shifts_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organizationId_organizations_id_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;