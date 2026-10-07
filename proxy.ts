import { NextResponse, type NextRequest } from "next/server";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { ORGANIZATION_NOT_FOUND_PATH } from "@/lib/organizationRoutes";
import { OrganizationsService } from "@/lib/services/OrganizationService";

export async function proxy(request: NextRequest) {
  const slug = getSlugFromHost(request.headers.get("host") ?? undefined);
  // Loopback also supports test sessions with an explicit active organization.
  if (
    slug === "servicestart" ||
    (await OrganizationsService.findBySlug(slug))
  ) {
    return NextResponse.next();
  }
  // Set the status before React starts streaming. Keep the original tenant URL.
  const destination = request.nextUrl.clone();
  destination.pathname = ORGANIZATION_NOT_FOUND_PATH;
  destination.search = "";
  const response = NextResponse.rewrite(destination, { status: 404 });
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

// Auth pages need a missing-tenant screen before hydration; ordinary pages
// already resolve their organization through their server auth guards.
export const config = {
  matcher: ["/login", "/signup", "/forgotpassword", "/resetpassword"],
};
