ALTER TABLE "shift_rsvps" DROP CONSTRAINT "shift_rsvps_pkey";--> statement-breakpoint
ALTER TABLE "shift_rsvps" ADD PRIMARY KEY ("shift_id","user_id");