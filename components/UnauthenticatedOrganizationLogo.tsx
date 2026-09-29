import OrganizationLogo from "@/components/OrganizationLogo";
import { resolveOrganizationLogo } from "@/lib/organizationBranding";
import { cn } from "@/lib/utils";

type UnauthenticatedOrganizationLogoProps = {
  logoUrl?: string | null;
};

export default function UnauthenticatedOrganizationLogo({
  logoUrl,
}: UnauthenticatedOrganizationLogoProps) {
  const { isCustom } = resolveOrganizationLogo(logoUrl);

  return (
    <div className="absolute bottom-8 left-8 flex items-center gap-1">
      <OrganizationLogo
        logoUrl={logoUrl}
        className={cn(
          "size-[72px] shrink-0",
          !isCustom && "drop-shadow-[0_2px_8px_rgba(253,128,51,0.55)]",
        )}
      />
      {!isCustom && (
        <div className="flex flex-col items-start gap-1">
          <img
            src="/bog.svg"
            alt="bits of good"
            className="h-[11.25px] w-[63px]"
          />
          <img
            src="/sunset.svg"
            alt="sunset"
            className="h-[20.25px] w-[99px]"
          />
        </div>
      )}
    </div>
  );
}
