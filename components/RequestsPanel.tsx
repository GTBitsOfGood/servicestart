"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import BogDropdown from "@/components/bog/BogDropdown/BogDropdown";
import BogChip from "@/components/bog/BogChip/BogChip";
import NotificationItem from "@/components/notifications/NotificationItem";
import { JoinRequestStatus, NotificationType } from "@/lib/schema";
import type {
  JoinRequestWithUser,
  JoinRequestHistoryEntry,
} from "@/lib/services/JoinRequestService";
import api from "@/lib/api";
import authClient from "@/lib/authClient";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";
import { isAdmin } from "@/lib/clientUtils";

type SortByOption = "time_desc" | "time_asc" | "alpha_asc" | "alpha_desc";

const SORT_LABELS: Record<SortByOption, string> = {
  time_desc: "Newest First",
  time_asc: "Oldest First",
  alpha_asc: "A-Z",
  alpha_desc: "Z-A",
};

const SORT_OPTIONS = Object.values(SORT_LABELS);

function sortRequests(requests: JoinRequestWithUser[], sortBy: SortByOption) {
  return [...requests].sort((a, b) => {
    if (sortBy === "time_desc")
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === "time_asc")
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    const nameA = (a.user.name || "").toLowerCase();
    const nameB = (b.user.name || "").toLowerCase();
    if (sortBy === "alpha_asc") return nameA.localeCompare(nameB);
    if (sortBy === "alpha_desc") return nameB.localeCompare(nameA);
    return 0;
  });
}

type Status = "loading" | "error" | "forbidden" | "ok";

interface RequestsPanelProps {
  side?: "left" | "right";
}

export default function RequestsPanel({ side = "right" }: RequestsPanelProps) {
  const { data: session, isPending: isSessionLoading } =
    authClient.useSession();
  const { organization } = useActiveOrganization();
  const isAuthorized = isAdmin(organization?.data, session?.user);

  const [search, setSearch] = useState("");
  const [typeFilters, setTypeFilters] = useState<Set<JoinRequestStatus>>(
    new Set(),
  );
  const [sortBy, setSortBy] = useState<SortByOption>("time_desc");
  const [joinRequests, setJoinRequests] = useState<JoinRequestWithUser[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetchJoinRequests = useCallback(async () => {
    if (!isAuthorized) return;
    const res = await api.joinRequests.$get({
      query: { page: "1", pageSize: "100" },
    });
    if (res.status === 403) {
      setStatus("forbidden");
      return;
    }

    if (!res.ok) throw new Error("Failed to fetch join requests");
    const json = await res.json();
    setJoinRequests(
      (json.data as unknown[]).map((item) => {
        const jr = item as Record<string, unknown>;
        return {
          ...jr,
          createdAt: new Date(jr.createdAt as string),
          history: (jr.history as Record<string, unknown>[]).map((h) => ({
            ...h,
            resolvedAt: new Date(h.resolvedAt as string),
          })),
        } as JoinRequestWithUser;
      }),
    );
    setStatus("ok");
  }, [isAuthorized]);

  useEffect(() => {
    fetchJoinRequests().catch(() => setStatus("error"));
  }, [fetchJoinRequests]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchJoinRequests();
    } catch {
      setStatus("error");
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchJoinRequests]);

  const toggleTypeFilter = (s: JoinRequestStatus) =>
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });

  const handleApprove = useCallback(
    (id: string) => {
      api.joinRequests
        .$patch({ query: { id, status: JoinRequestStatus.Approved } })
        .then(refresh)
        .catch(() => setStatus("error"));
    },
    [refresh],
  );

  const handleDeny = useCallback(
    (id: string, denialReason: string) => {
      api.joinRequests
        .$patch({
          query: { id, status: JoinRequestStatus.Denied, denialReason },
        })
        .then(refresh)
        .catch(() => setStatus("error"));
    },
    [refresh],
  );

  const handleRemoveAccess = useCallback(
    (id: string) => {
      api.joinRequests
        .$patch({
          query: { id, status: JoinRequestStatus.Pending },
        })
        .then(refresh)
        .catch(() => setStatus("error"));
    },
    [refresh],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const matches = joinRequests.filter(
      (jr) =>
        jr.user.name?.toLowerCase().includes(q) ||
        jr.user.email?.toLowerCase().includes(q),
    );
    const withFilters =
      typeFilters.size > 0
        ? matches.filter((jr) => typeFilters.has(jr.status))
        : matches;
    return sortRequests(withFilters, sortBy);
  }, [joinRequests, search, typeFilters, sortBy]);

  const pending = filtered.filter(
    (jr) => jr.status === JoinRequestStatus.Pending,
  );
  const approved = filtered.filter(
    (jr) => jr.status === JoinRequestStatus.Approved,
  );
  const denied = filtered.filter(
    (jr) => jr.status === JoinRequestStatus.Denied,
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (organization?.isPending || isSessionLoading) return null;
  if (!isAuthorized || status === "forbidden") return null;

  const sharedItemProps = (
    jr: JoinRequestWithUser,
    type: NotificationType,
  ) => ({
    notification: {
      id: jr.id,
      userId: jr.user.id,
      organizationId: jr.organizationId,
      createdAt: String(jr.createdAt),
      read: true,
      type,
      text: `${jr.user.name || jr.user.email} is requesting access to ${jr.organization}`,
    },
    joinRequest: {
      status: jr.status,
      user: jr.user,
      denialReason: jr.denialReason,
      history: jr.history as JoinRequestHistoryEntry[],
      organization: jr.organization,
    },
    onApprove: handleApprove,
    onDeny: handleDeny,
    onRemoveAccess: handleRemoveAccess,
  });

  const borderClass =
    side === "left"
      ? "border-r border-grey-stroke-weak"
      : "border-l border-grey-stroke-weak";

  return (
    <aside
      className={`flex h-screen w-[580px] shrink-0 flex-col ${borderClass} bg-white pt-10`}
    >
      <div className="border-b border-grey-stroke-weak px-6 py-5">
        <h2 className="text-right text-heading-2 text-grey-text-strong">
          Requests
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex w-full items-center gap-3">
            <div className="flex-1 min-w-0">
              <BogTextInput
                name="search"
                type="search"
                placeholder="Enter text to search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                iconProps={{
                  iconProps: { name: "search", size: 20 },
                  position: "right",
                }}
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <BogDropdown
                type="checkbox"
                name="typeFilter"
                placeholder="Type"
                options={["Pending", "Approved", "Denied"]}
                value={Array.from(typeFilters).map(
                  (s) => s.charAt(0).toUpperCase() + s.slice(1),
                )}
                onSelectionChange={(selection) => {
                  const values = (
                    Array.isArray(selection) ? selection : [selection]
                  ) as string[];
                  setTypeFilters(
                    new Set(
                      values.map((v) => v.toLowerCase() as JoinRequestStatus),
                    ),
                  );
                }}
                variant="primary"
                radius="full"
                size="small"
                showValueInTrigger={false}
                showClearIcon={false}
                className="w-[130px] px-2 py-1 font-medium text-[13px] justify-center gap-2"
              />
              <BogDropdown
                type="radio"
                name="sortBy"
                placeholder="Sort By"
                options={SORT_OPTIONS}
                value={[SORT_LABELS[sortBy]]}
                onSelectionChange={(selection) => {
                  const values = (
                    Array.isArray(selection) ? selection : [selection]
                  ) as string[];
                  const label = values.at(-1);
                  const match = Object.entries(SORT_LABELS).find(
                    ([, v]) => v === label,
                  );
                  setSortBy(match ? (match[0] as SortByOption) : "time_desc");
                }}
                variant="primary"
                radius="full"
                size="small"
                showValueInTrigger={false}
                showClearIcon={false}
                className="w-[130px] px-2 py-1 font-medium text-[13px] justify-center gap-2"
              />
            </div>
          </div>

          {(typeFilters.size > 0 || sortBy !== "time_desc") && (
            <div className="flex items-center justify-end gap-2 mt-1 flex-wrap">
              {sortBy !== "time_desc" && (
                <BogChip
                  variant="soft"
                  color="gray"
                  className="cursor-pointer gap-2 px-2 py-1"
                  onClick={() => setSortBy("time_desc")}
                >
                  <span className="text-[11px] font-medium text-grey-text-strong">
                    {SORT_LABELS[sortBy]}
                  </span>
                  <BogIcon
                    name="x"
                    size={10}
                    color="var(--color-grey-text-strong)"
                  />
                </BogChip>
              )}
              {Array.from(typeFilters).map((s) => (
                <BogChip
                  key={s}
                  variant="soft"
                  color="gray"
                  className="cursor-pointer gap-2 px-2 py-1"
                  onClick={() => toggleTypeFilter(s)}
                >
                  <span className="text-[11px] font-medium text-grey-text-strong">
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </span>
                  <BogIcon
                    name="x"
                    size={10}
                    color="var(--color-grey-text-strong)"
                  />
                </BogChip>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {status === "loading" ? (
          <div className="space-y-px animate-pulse p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-grey-fill-weak" />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
            <p className="text-paragraph-2 text-grey-text-weak">
              Unable to load requests.
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="rounded border border-grey-stroke-strong px-4 py-2 text-paragraph-2 text-grey-text-strong hover:bg-grey-fill-weaker disabled:opacity-50"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <Section label="Pending" count={pending.length} defaultOpen>
              {pending.length === 0 ? (
                <p className="px-10 py-6 font-bold text-grey-text-strong text-paragraph-1">
                  There are no pending requests at this time.
                </p>
              ) : (
                pending.map((jr) => (
                  <NotificationItem
                    key={jr.id}
                    {...sharedItemProps(jr, NotificationType.ActionRequired)}
                  />
                ))
              )}
            </Section>
            <Section
              label="Approved"
              count={approved.length}
              defaultOpen={false}
            >
              {approved.length === 0 ? (
                <p className="px-10 py-6 font-bold text-grey-text-strong text-paragraph-1">
                  There are no approved requests at this time.
                </p>
              ) : (
                approved.map((jr) => (
                  <NotificationItem
                    key={jr.id}
                    {...sharedItemProps(jr, NotificationType.General)}
                    hideTag
                  />
                ))
              )}
            </Section>
            <Section label="Denied" count={denied.length} defaultOpen={false}>
              {denied.length === 0 ? (
                <p className="px-10 py-6 font-bold text-grey-text-strong text-paragraph-1">
                  There are no denied requests at this time.
                </p>
              ) : (
                denied.map((jr) => (
                  <NotificationItem
                    key={jr.id}
                    {...sharedItemProps(jr, NotificationType.General)}
                    hideTag
                  />
                ))
              )}
            </Section>
          </>
        )}
      </div>
    </aside>
  );
}

function Section({
  label,
  count,
  children,
  defaultOpen = true,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-grey-stroke-weak last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-10 py-6 text-left bg-grey-fill-weak"
      >
        <div className="text-paragraph-1 font-extrabold text-grey-text-weak">
          {count} {label}
        </div>
        <BogIcon name={open ? "chevron-up" : "chevron-right"} size={18} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
