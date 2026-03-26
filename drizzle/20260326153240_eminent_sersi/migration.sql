ALTER TABLE "join_requests" DROP CONSTRAINT "join_requests_resolved_by_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "join_requests" DROP COLUMN "resolved_by_user_id";--> statement-breakpoint
ALTER TABLE "join_requests" DROP COLUMN "resolved_at";