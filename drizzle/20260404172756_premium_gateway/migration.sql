CREATE TABLE "join_request_history" (
	"id" text PRIMARY KEY,
	"join_request_id" text NOT NULL,
	"action" text NOT NULL,
	"resolved_by_user_id" text,
	"resolved_at" timestamp DEFAULT now() NOT NULL,
	"denial_reason" text
);
--> statement-breakpoint
ALTER TABLE "join_requests" ADD COLUMN "denial_reason" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "join_request_history" ADD CONSTRAINT "join_request_history_join_request_id_join_requests_id_fkey" FOREIGN KEY ("join_request_id") REFERENCES "join_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "join_request_history" ADD CONSTRAINT "join_request_history_resolved_by_user_id_users_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;