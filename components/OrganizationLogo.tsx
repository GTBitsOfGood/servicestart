import { resolveOrganizationLogo } from "@/lib/organizationBranding";
import { cn } from "@/lib/utils";

type OrganizationLogoProps = {
  logoUrl?: string | null;
  className?: string;
  alt?: string;
};

export default function OrganizationLogo({
  logoUrl,
  className,
  alt = "Organization logo",
}: OrganizationLogoProps) {
  const { src } = resolveOrganizationLogo(logoUrl);

  return (
    <img
      src={src}
      alt={alt}
      className={cn("object-contain", className)}
      data-testid="organization-logo"
    />
  );
}
