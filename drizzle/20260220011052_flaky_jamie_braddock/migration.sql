DROP INDEX IF EXISTS "media_file_name_idx";--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = 'eventId') THEN
    ALTER TABLE "shifts" ADD COLUMN "eventId" text NOT NULL;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_fileName_idx" ON "media" ("file_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_eventId_idx" ON "shifts" ("eventId");--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'shifts' AND constraint_name = 'shifts_eventId_events_id_fkey') THEN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_eventId_events_id_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE;
  END IF;
END $$;