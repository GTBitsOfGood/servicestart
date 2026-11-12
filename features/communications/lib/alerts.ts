import { z } from "zod";
import { MemberTypeKeySchema } from "@/features/membership";

/** Shared validation for admins posting dashboard announcements. */
export const PostDashboardAlertSchema = z.strictObject({
  title: z.string().trim().min(1, "Enter an alert title").max(120),
  message: z.string().trim().min(1, "Enter an alert message").max(2_000),
  memberTypes: z.array(MemberTypeKeySchema).min(1).optional(),
});

export type PostDashboardAlert = z.infer<typeof PostDashboardAlertSchema>;
