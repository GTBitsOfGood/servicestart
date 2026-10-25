import type { MemberType, OrganizationConfigKey } from "@/lib/schema";

export type NavbarConfig = {
  variant: string;
  color: string;
};

export type SeedUser = {
  name: string;
  email: string;
  role: string | null;
  phoneNumber: string | null;
  memberType?: MemberType;
};

export type SeedOrg = {
  id: string;
  name: string;
  slug: string;
  navbar: NavbarConfig;
  config?: Partial<Record<OrganizationConfigKey, string>>;
  // Accounts only this org gets, on top of the shared ones in main().
  extraUsers?: SeedUser[];
  // Member types for the shared accounts in this org, by email.
  memberTypes?: Record<string, MemberType>;
};
