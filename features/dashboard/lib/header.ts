import { z } from "zod";
import type { DashboardAudience } from "@/features/membership";

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

export const DashboardHeaderConfigSchema = z.record(
  z.string(),
  DashboardHeaderContentSchema.optional(),
);
export type DashboardHeaderConfig = z.infer<typeof DashboardHeaderConfigSchema>;

/** With no config, every audience gets today's built-in heading. */
export const DEFAULT_DASHBOARD_HEADER_CONFIG: DashboardHeaderConfig = {};

export type ResolvedDashboardHeader = DashboardHeaderContent & {
  title: string;
};

function builtInTitle(audience: DashboardAudience) {
  return audience === "admin" ? "Admin Dashboard" : "Dashboard";
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

/**
 * Selects the viewer's audience entry, then the default entry. A configured
 * entry is intentionally not merged with the default: fields omitted by an
 * organization stay omitted. The title is the one exception because every
 * dashboard still needs its existing built-in heading.
 */
export function resolveDashboardHeader(
  config: DashboardHeaderConfig,
  audience: DashboardAudience,
  userName: string,
): ResolvedDashboardHeader {
  const content = config[audience] ?? config.default ?? {};
  const title = content.title ?? builtInTitle(audience);

  return {
    ...content,
    title: title.replaceAll("{firstName}", firstName(userName)),
  };
}
