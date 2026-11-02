import type { Icon } from "@phosphor-icons/react";
import {
  FacebookLogoIcon,
  GlobeIcon,
  InstagramLogoIcon,
  LinkedinLogoIcon,
  TiktokLogoIcon,
  XLogoIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react/ssr";
import OrganizationLogo from "@/components/OrganizationLogo";
import type {
  OrganizationFooter as OrganizationFooterConfig,
  SocialPlatform,
} from "@/lib/footer";
import { OrganizationConfigKey } from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

export type OrganizationFooterProps = { organizationId: string };

const SOCIAL_PLATFORM_DETAILS: Record<
  SocialPlatform,
  { label: string; icon: Icon }
> = {
  instagram: { label: "Instagram", icon: InstagramLogoIcon },
  facebook: { label: "Facebook", icon: FacebookLogoIcon },
  linkedin: { label: "LinkedIn", icon: LinkedinLogoIcon },
  x: { label: "X", icon: XLogoIcon },
  youtube: { label: "YouTube", icon: YoutubeLogoIcon },
  tiktok: { label: "TikTok", icon: TiktokLogoIcon },
  website: { label: "Website", icon: GlobeIcon },
};

function hasFooterContent(footer: OrganizationFooterConfig) {
  return Boolean(
    footer.email ||
    footer.phone ||
    footer.address ||
    footer.ein ||
    footer.socialLinks?.length,
  );
}

export default async function OrganizationFooter({
  organizationId,
}: OrganizationFooterProps) {
  const [footer, logoConfig] = await Promise.all([
    OrganizationConfigService.getOrganizationFooter(organizationId),
    OrganizationConfigService.getConfig(organizationId, [
      OrganizationConfigKey.LogoUrl,
    ]),
  ]);

  if (!hasFooterContent(footer)) return null;

  const logoUrl = logoConfig[OrganizationConfigKey.LogoUrl];

  return (
    <footer className="flex flex-col gap-8 border border-grey-stroke-weak bg-solid-bg-base px-6 py-8 text-small text-grey-text-weak mobile:flex-row mobile:items-center mobile:justify-between desktop:px-(--organization-footer-inline-padding) desktop:py-(--organization-footer-block-padding)">
      <div className="flex flex-col gap-(--organization-footer-section-gap)">
        <address className="flex flex-col gap-(--organization-footer-contact-gap) not-italic">
          {footer.email && (
            <p className="text-small">
              Email:{" "}
              <a
                className="text-small underline"
                href={`mailto:${footer.email}`}
              >
                {footer.email}
              </a>
            </p>
          )}
          {footer.phone && (
            <p className="text-small">
              Phone:{" "}
              <a className="text-small underline" href={`tel:${footer.phone}`}>
                {footer.phone}
              </a>
            </p>
          )}
          {footer.address && (
            <p className="text-small">Address: {footer.address}</p>
          )}
          {footer.ein && <p className="text-small">EIN: {footer.ein}</p>}
        </address>

        {footer.socialLinks && footer.socialLinks.length > 0 && (
          <ul className="flex flex-wrap items-center gap-3">
            {footer.socialLinks.map(({ platform, url }) => {
              const { label, icon: SocialIcon } =
                SOCIAL_PLATFORM_DETAILS[platform];

              return (
                <li key={`${platform}-${url}`}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="block text-brand-text hover:opacity-75"
                  >
                    <SocialIcon aria-hidden size={20} />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <OrganizationLogo
        logoUrl={logoUrl}
        className="h-24 w-auto self-end mobile:h-(--organization-footer-logo-height) mobile:self-center"
      />
    </footer>
  );
}
