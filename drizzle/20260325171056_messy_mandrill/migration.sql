ALTER TABLE "join_requests" ADD COLUMN "resolved_by_user_id" text;--> statement-breakpoint
ALTER TABLE "join_requests" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_resolved_by_user_id_users_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;