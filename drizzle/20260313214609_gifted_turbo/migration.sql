-- ALTER TABLE "announcements" RENAME COLUMN "title" TO "name";--> statement-breakpoint
-- ALTER TABLE "announcements" RENAME COLUMN "body" TO "content";--> statement-breakpoint
-- ALTER TABLE "announcements" ADD COLUMN "subject" text NOT NULL;--> statement-breakpoint
-- ALTER TABLE "announcements" ADD COLUMN "template" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "published_by_id" text;--> statement-breakpoint
-- ALTER TABLE "announcements" ALTER COLUMN "content" SET DATA TYPE jsonb USING "content"::jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_published_by_id_users_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE CASCADE;