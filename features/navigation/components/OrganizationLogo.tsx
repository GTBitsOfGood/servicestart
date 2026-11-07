import { resolveOrganizationLogo } from "@/core/config/organizationBranding";
import { cn } from "@/core/utils/utils";

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
