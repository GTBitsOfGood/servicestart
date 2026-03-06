ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "eventId" text NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_eventId_idx" ON "shifts" ("eventId");--> statement-breakpoint
ALTER TABLE "shifts" DROP CONSTRAINT IF EXISTS "shifts_eventId_events_id_fkey";--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_eventId_events_id_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE;