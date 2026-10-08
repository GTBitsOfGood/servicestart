import { NextResponse, type NextRequest } from "next/server";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { ORGANIZATION_NOT_FOUND_PATH } from "@/lib/organizationRoutes";

export async function proxy(request: NextRequest) {
  const slug = getSlugFromHost(request.headers.get("host") ?? undefined);
  // Loopback also supports test sessions with an explicit active organization.
  if (slug === "servicestart") return NextResponse.next();

  // Netlify bundles this proxy for its edge runtime. Resolve through the public
  // server API so PostgreSQL and its Node dependencies stay in the server bundle.
  const lookupUrl = request.nextUrl.clone();
  lookupUrl.pathname = "/api/organizationConfig";
  lookupUrl.search = "";
  lookupUrl.searchParams.set("organizationSlug", slug);
  lookupUrl.searchParams.set("keys", "tagline");
  let lookup: Response;
  try {
    lookup = await fetch(lookupUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return new NextResponse(
      "Organization lookup is unavailable. Please try again.",
      {
        status: 503,
      },
    );
  }
  if (lookup.ok) return NextResponse.next();
  if (lookup.status !== 404) {
    return new NextResponse(
      "Organization lookup is unavailable. Please try again.",
      {
        status: 503,
      },
    );
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
