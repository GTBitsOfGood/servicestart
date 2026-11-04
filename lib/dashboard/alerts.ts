import { z } from "zod";
import { MemberType } from "@/lib/schema";

/** Shared validation for admins posting dashboard announcements. */
export const PostDashboardAlertSchema = z.strictObject({
  title: z.string().trim().min(1, "Enter an alert title").max(120),
  message: z.string().trim().min(1, "Enter an alert message").max(2_000),
  memberTypes: z.array(z.enum(MemberType)).min(1).max(2).optional(),
});

export type PostDashboardAlert = z.infer<typeof PostDashboardAlertSchema>;
