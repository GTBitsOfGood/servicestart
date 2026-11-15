import type { IconName } from "@/components/bog/BogIcon/BogIcon";
import type { ToggleableOrganizationFeature } from "@/core/config/schema";

/*
 * A feature describes itself in its context's feature.ts: its toggle, navbar
 * items, and dashboard widgets. features/registry.ts lists every feature, and
 * the navbar and the widget picker read the list.
 *
 * Manifests are metadata only (no React components, services, or next/*
 * imports): the client bundle reaches them through the navbar and the config
 * schemas. API routes stay in features/app.ts.
 */

export type FeatureNavItem = {
  label: string;
  href: string;
  /** Top-level items only. */
  icon?: IconName;
  /** Position among its siblings, lowest first. Space by 10. */
  order: number;
  /** The href of the top-level item this is a subpage of. */
  parent?: string;
  /** Only admins and owners see it. */
  requireAdmin?: boolean;
};

export type FeatureWidget = {
  /** A WidgetId from features/dashboard/lib/schema.ts. */
  id: string;
  /** Its name in the widget picker. */
  label: string;
};

export type Feature = {
  id: string;
  /**
   * The config key that turns the feature on. While it's off, the feature's
   * navbar items and widgets are hidden. Hiding is presentation only; pages
   * and routes keep their own guards (core/auth/featureGuards.ts).
   */
  toggle?: ToggleableOrganizationFeature;
  navItems?: readonly FeatureNavItem[];
  widgets?: readonly FeatureWidget[];
};

export function defineFeature<const F extends Feature>(feature: F): F {
  return feature;
}
