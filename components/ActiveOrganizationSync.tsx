"use client";

import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

export function ActiveOrganizationSync() {
  useActiveOrganization();
  return null;
}
