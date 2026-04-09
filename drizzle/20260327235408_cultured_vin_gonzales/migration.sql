CREATE TYPE "visibility" AS ENUM('public', 'member-only');--> statement-breakpoint
CREATE TABLE "event_hosts" (
	"user_id" text NOT NULL,
	"event_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "rsvp_limit" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "rsvp_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "visibility" "visibility" DEFAULT 'member-only' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "accessibility_notes" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "links" text[];--> statement-breakpoint
ALTER TABLE "event_hosts" ADD CONSTRAINT "event_hosts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_hosts" ADD CONSTRAINT "event_hosts_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;