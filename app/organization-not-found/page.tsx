import OrganizationNotFound from "@/components/OrganizationNotFound";

// This terminal destination must never invoke a session or membership guard.
export default function OrganizationNotFoundPage() {
  return <OrganizationNotFound />;
}
