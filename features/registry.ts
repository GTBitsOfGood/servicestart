import type { Feature } from "@/core/features/defineFeature";
import type { ToggleableOrganizationFeature } from "@/core/config/schema";
import { communications } from "@/features/communications/feature";
import { dashboard } from "@/features/dashboard/feature";
import { events } from "@/features/events/feature";
import { forms } from "@/features/forms/feature";
import { media } from "@/features/media/feature";
import {
  members,
  memberTypes,
  membership,
} from "@/features/membership/feature";
import { settings } from "@/features/settings/feature";

/*
 * Every feature's manifest (see core/features/defineFeature.ts). The navbar
 * and the dashboard's widget picker read this list; adding a feature is one
 * line here. Like the manifests, this file is metadata only, so client code
 * may import it.
 */
export const FEATURES: readonly Feature[] = [
  dashboard,
  membership,
  members,
  memberTypes,
  media,
  communications,
  settings,
  events,
  forms,
];

/** Every feature toggle, to read in one getConfig call. */
export const FEATURE_TOGGLES: readonly ToggleableOrganizationFeature[] = [
  ...new Set(FEATURES.flatMap(({ toggle }) => (toggle ? [toggle] : []))),
];
