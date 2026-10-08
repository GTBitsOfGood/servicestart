import { headers } from "next/headers";
import OrganizationNotFound from "@/components/OrganizationNotFound";

export default async function OrganizationNotFoundPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") === "https" ? "https:" : "http:";
  return <OrganizationNotFound host={host} protocol={protocol} />;
}
