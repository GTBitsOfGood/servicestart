import { z } from "zod";

/*
 * The text above an org's dashboard (#320): a title, a subtitle, a
 * description, and program details like where and when it meets. Each
 * audience can have its own; `default` covers any audience without one.
 */

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).optional();

export const DashboardHeaderContentSchema = z.strictObject({
  /** `{firstName}` is replaced with the viewer's first name. */
  title: optionalText(120),
  subtitle: optionalText(200),
  description: optionalText(2000),
  location: optionalText(200),
  dates: optionalText(100),
  schedule: optionalText(100),
});
export type DashboardHeaderContent = z.infer<
  typeof DashboardHeaderContentSchema
>;

export const DashboardHeaderConfigSchema = z.strictObject({
  default: DashboardHeaderContentSchema.optional(),
  admin: DashboardHeaderContentSchema.optional(),
  member: DashboardHeaderContentSchema.optional(),
  applicant: DashboardHeaderContentSchema.optional(),
  attendee: DashboardHeaderContentSchema.optional(),
});
export type DashboardHeaderConfig = z.infer<typeof DashboardHeaderConfigSchema>;

/** With no config, every audience gets today's built-in heading. */
export const DEFAULT_DASHBOARD_HEADER_CONFIG: DashboardHeaderConfig = {};
