import type { Context } from "hono";
import { getSlugFromHost } from "@/core/tenant/host";
import { OrganizationsService } from "@/core/tenant/OrganizationService";
import { ForbiddenError } from "@/core/api/errors";

type OrganizationSession = {
  session: { [key: string]: unknown; activeOrganizationId?: unknown };
} | null;

/**
 * Host wins, even if it names an unknown org. Default hosts use the active
 * session org. Callers supply their session so auth hooks never recurse into
 * getSession while resolving their own organization.
 */
export async function resolveOrganization(
  request: Headers | Context,
  session: OrganizationSession = null,
) {
  const headers =
    "req" in request ? new Headers(request.req.header()) : request;
  const slug = getSlugFromHost(headers.get("host"));
  if (slug) return OrganizationsService.findBySlug(slug);
  const id = session?.session.activeOrganizationId;
  return typeof id === "string" && id
    ? OrganizationsService.findById(id)
    : null;
}

/** Authorization still uses the active org; a tenant host cannot override it. */
export async function assertOrganizationMatchesHost(
  request: Headers | Context,
  session: OrganizationSession,
) {
  const headers =
    "req" in request ? new Headers(request.req.header()) : request;
  if (
    !session?.session.activeOrganizationId ||
    !getSlugFromHost(headers.get("host"))
  )
    return;
  const organization = await resolveOrganization(headers);
  if (
    !organization ||
    organization.id !== session?.session.activeOrganizationId
  ) {
    throw new ForbiddenError();
  }
}
