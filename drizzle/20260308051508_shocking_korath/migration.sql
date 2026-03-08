ALTER TYPE "notification_type" ADD VALUE 'action_required';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE 'reminder';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE 'members';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE 'schedule_update';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE 'confirmation';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'navbar_variant' BEFORE 'members_page_enabled';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'navbar_color' BEFORE 'members_page_enabled';--> statement-breakpoint
ALTER TYPE "organization_config_key" ADD VALUE 'logo_url';