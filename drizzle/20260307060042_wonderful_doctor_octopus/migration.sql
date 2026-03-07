ALTER TABLE "events" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "published_by_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_published_by_id_users_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE CASCADE;