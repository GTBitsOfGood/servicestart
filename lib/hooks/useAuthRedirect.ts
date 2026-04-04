"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import authClient from "@/lib/authClient";
import { JoinRequestStatus } from "@/lib/schema";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

type RedirectGuardOptions = {
  requireAdmin?: boolean;
};

type JoinRequestResponse = {
  status: JoinRequestStatus;
};

type ActiveOrganizationData = NonNullable<
  ReturnType<typeof authClient.useActiveOrganization>["data"]
>;
type ActiveOrganizationMember = ActiveOrganizationData["members"][number];
type OrganizationRole = ActiveOrganizationMember["role"];

type ResolvedJoinRequest = {
  key: string;
  status: JoinRequestStatus | null;
} | null;

function isAdminOrOwnerRole(role?: OrganizationRole | null) {
  return role === "admin" || role === "owner";
}

function useRedirectGuard({ requireAdmin = false }: RedirectGuardOptions = {}) {
  const router = useRouter();
  const session = authClient.useSession();
  const { organization } = useActiveOrganization();
  const [resolvedJoinRequest, setResolvedJoinRequest] =
    useState<ResolvedJoinRequest>(null);
  const lastRedirectRef = useRef<string | null>(null);

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
  const role = membership?.role;
  const joinRequestLookupKey =
    user && !membership && organizationId
      ? `${user.id}:${organizationId}`
      : null;
  const joinRequestStatus =
    resolvedJoinRequest?.key === joinRequestLookupKey
      ? resolvedJoinRequest.status
      : undefined;
  const isCheckingAccess =
    !!session.isPending ||
    !!organization.isPending ||
    !!organization.isRefetching ||
    (joinRequestLookupKey !== null && joinRequestStatus === undefined);

  useEffect(() => {
    if (!joinRequestLookupKey || !organizationId) {
      return;
    }

    const resolvedJoinRequestLookupKey = joinRequestLookupKey;
    const resolvedOrganizationId = organizationId;
    let cancelled = false;

    async function resolveJoinRequest() {
      try {
        const response = await api.joinRequests[":organizationId"].$get({
          param: { organizationId: resolvedOrganizationId },
        });

        if (cancelled) return;

        if (!response.ok) {
          setResolvedJoinRequest({
            key: resolvedJoinRequestLookupKey,
            status: null,
          });
          return;
        }

        const joinRequest = (await response.json()) as JoinRequestResponse;
        setResolvedJoinRequest({
          key: resolvedJoinRequestLookupKey,
          status: joinRequest.status,
        });
      } catch {
        if (!cancelled) {
          setResolvedJoinRequest({
            key: resolvedJoinRequestLookupKey,
            status: null,
          });
        }
      }
    }

    void resolveJoinRequest();

    return () => {
      cancelled = true;
    };
  }, [joinRequestLookupKey, organizationId]);

  const redirectTarget = useMemo(() => {
    if (
      session.isPending ||
      organization.isPending ||
      organization.isRefetching
    ) {
      return null;
    }

    if (!user) {
      return "/login";
    }

    if (membership) {
      if (requireAdmin && !isAdminOrOwnerRole(role)) {
        return "/";
      }

      return null;
    }

    if (organizationId && joinRequestStatus === undefined) {
      return null;
    }

    if (joinRequestStatus === JoinRequestStatus.Pending) {
      return "/joinrequeststatus";
    }

    return "/";
  }, [
    joinRequestStatus,
    membership,
    organization.isPending,
    organization.isRefetching,
    organizationId,
    requireAdmin,
    role,
    session.isPending,
    user,
  ]);

  useEffect(() => {
    if (!redirectTarget) {
      lastRedirectRef.current = null;
      return;
    }

    if (lastRedirectRef.current === redirectTarget) {
      return;
    }

    lastRedirectRef.current = redirectTarget;
    router.replace(redirectTarget);
  }, [redirectTarget, router]);

  return {
    canAccess: !!membership && (!requireAdmin || isAdminOrOwnerRole(role)),
    isCheckingAccess,
  };
}

export function useRedirectIfNotMember() {
  return useRedirectGuard();
}

export function useRedirectIfNotAdmin() {
  return useRedirectGuard({ requireAdmin: true });
}
