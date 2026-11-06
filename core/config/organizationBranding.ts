const DEFAULT_ORGANIZATION_LOGO = "/logo.svg";

export function resolveOrganizationLogo(logoUrl?: string | null) {
  const customSrc = logoUrl?.trim();

  return {
    src: customSrc || DEFAULT_ORGANIZATION_LOGO,
    isCustom: Boolean(customSrc),
  };
}
