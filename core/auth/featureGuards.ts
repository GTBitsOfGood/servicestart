import { notFound } from "next/navigation";
import { NotFoundError } from "@/core/api/errors";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import type { ToggleableOrganizationFeature } from "@/core/config/schema";

/*
 * Feature toggles, enforced on the server. A feature that's off for an org
 * looks like it doesn't exist there: its routes and pages are 404s. Hiding a
 * nav item is not access control; call one of these too.
 */

async function isFeatureEnabled(
  organizationId: string,
  key: ToggleableOrganizationFeature,
) {
  const config = await OrganizationConfigService.getConfig(organizationId, [
    key,
  ]);
  return config[key] === true;
}

/** For API routes: throws NotFoundError (404) while the toggle is off. */
export async function assertFeatureEnabled(
  organizationId: string,
  key: ToggleableOrganizationFeature,
) {
  if (!(await isFeatureEnabled(organizationId, key))) throw new NotFoundError();
}

/** For server pages: renders the not-found page while the toggle is off. */
export async function notFoundIfFeatureDisabled(
  organizationId: string,
  key: ToggleableOrganizationFeature,
) {
  if (!(await isFeatureEnabled(organizationId, key))) notFound();
}
