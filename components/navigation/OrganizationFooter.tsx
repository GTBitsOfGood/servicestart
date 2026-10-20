import type { ReactNode } from "react";

export type OrganizationFooterProps = { organizationId: string };

// Placeholder until #320 renders the org's footer (OrganizationFooter config:
// contact details, EIN, social links). An org without one has no footer.
const OrganizationFooter: (
  props: OrganizationFooterProps,
) => Promise<ReactNode> = async () => null;

export default OrganizationFooter;
