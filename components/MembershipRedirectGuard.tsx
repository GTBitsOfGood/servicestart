"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import authClient from "@/lib/authClient";
import { MEMBERSHIP_REDIRECT_EXCLUDED_PAGES } from "@/lib/navbar";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

export default function MembershipRedirectGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const session = authClient.useSession();
  const { organization } = useActiveOrganization();
  const lastRedirectRef = useRef<string | null>(null);

  const isExcludedPath = MEMBERSHIP_REDIRECT_EXCLUDED_PAGES.includes(pathname);
  const user = session.data?.user;
  const organizationData = organization.data;
  const organizationId =
    organizationData?.id ?? session.data?.session.activeOrganizationId ?? null;
  const membership = useMemo(() => {
    if (!organizationData || !user) {
      return null;
    }

    return (
      organizationData.members.find((member) => member.userId === user.id) ??
      null
    );
  }, [organizationData, user]);

  useEffect(() => {
    if (isExcludedPath) {
      lastRedirectRef.current = null;
      return;
    }

    if (
      session.isPending ||
      organization.isPending ||
      organization.isRefetching ||
      !user ||
      membership ||
      !organizationId
    ) {
      lastRedirectRef.current = null;
      return;
    }

    if (lastRedirectRef.current === "/joinrequeststatus") {
      return;
    }

    lastRedirectRef.current = "/joinrequeststatus";
    router.replace("/joinrequeststatus");
  }, [
    isExcludedPath,
    membership,
    organization.isPending,
    organization.isRefetching,
    organizationId,
    router,
    session.isPending,
    user,
  ]);

  return null;
}
