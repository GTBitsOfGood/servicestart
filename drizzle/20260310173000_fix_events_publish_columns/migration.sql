ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "published_by_id" text;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'events_published_by_id_users_id_fkey'
	) THEN
		ALTER TABLE "events"
		ADD CONSTRAINT "events_published_by_id_users_id_fkey"
		FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE CASCADE;
	END IF;
END
$$;
