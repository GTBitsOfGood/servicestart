import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { OrganizationsService } from "@/lib/services/OrganizationService";

/** Resolves the tenant organization from a request `Host` header value. */
export async function findOrganizationByRequestHost(
  host: string | null | undefined,
) {
  const slug = getSlugFromHost(host ?? undefined);
  if (!slug) return null;
  return OrganizationsService.findBySlug(slug);
}
