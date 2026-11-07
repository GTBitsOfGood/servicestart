"use client";

import { useActiveOrganization } from "@/core/tenant/hooks/useActiveOrganization";

export function ActiveOrganizationSync() {
  useActiveOrganization();
  return null;
}
