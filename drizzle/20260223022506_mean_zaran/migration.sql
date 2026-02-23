ALTER INDEX "media_file_name_idx" RENAME TO "media_fileName_idx";--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number" text;