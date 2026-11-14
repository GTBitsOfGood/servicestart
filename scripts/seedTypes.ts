import type { OrganizationConfigKey } from "@/core/db/schema";
import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";

export type NavbarConfig = {
  variant: string;
  color: string;
};

export type SeedUser = {
  name: string;
  email: string;
  role: string | null;
  phoneNumber: string | null;
  memberType?: MemberTypeKey;
};

export type SeedOrg = {
  id: string;
  name: string;
  slug: string;
  navbar: NavbarConfig;
  config?: Partial<Record<OrganizationConfigKey, string>>;
  extraUsers?: SeedUser[];
  memberTypes?: Record<string, MemberTypeKey>;
};
