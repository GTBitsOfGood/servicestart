import { JoinRequestsService } from "@/lib/services/joinRequests";
import { MembersService } from "@/lib/services/members";
import { OrganizationsService } from "@/lib/services/organizations";

const defaultOrganizationSlug = "servicestart";

export function getSlugFromHost(host?: string): string {
  if (!host) return defaultOrganizationSlug;

  const normalized = host.toLowerCase().split(":")[0]; // Remove port if present
  const match = normalized.match(/^([a-z0-9-]+)\.servicestart\.com$/);

  return match ? match[1] : defaultOrganizationSlug;
}

export async function createJoinRequestIfNeeded(userId: string, host?: string) {
  const slug = getSlugFromHost(host);

  const organization = await OrganizationsService.findBySlug(slug);
  if (!organization) return;

  const membership = await MembersService.findByUserAndOrganization(
    userId,
    organization.id,
  );
  if (membership) return;

  const existingRequest = await JoinRequestsService.findByUserAndOrganization(
    userId,
    organization.id,
  );
  if (existingRequest) return;

  await JoinRequestsService.create(userId, organization.id);
}
