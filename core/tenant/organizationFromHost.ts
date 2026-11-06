import { getSlugFromHost } from "@/core/tenant/clientAuthUtils";
import { OrganizationsService } from "@/core/tenant/OrganizationService";

/** Resolves the tenant organization from a request `Host` header value. */
export async function findOrganizationByRequestHost(
  host: string | null | undefined,
) {
  const slug = getSlugFromHost(host ?? undefined);
  if (!slug) return null;
  return OrganizationsService.findBySlug(slug);
}
