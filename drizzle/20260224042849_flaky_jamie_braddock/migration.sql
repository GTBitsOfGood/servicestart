ALTER TABLE "shifts" ADD COLUMN "eventId" text NOT NULL;--> statement-breakpoint
CREATE INDEX "shift_eventId_idx" ON "shifts" ("eventId");--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_eventId_events_id_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE;