"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PencilSimpleIcon } from "@/components/icons/PencilSimpleIcon";
import { UserPlusIcon } from "@/components/icons/UserPlusIcon";
import api from "@/lib/api";
import authClient from "@/lib/authClient";
import { formatDate } from "@/lib/clientUtils";
import BogCheckbox from "@/components/bog/BogCheckbox/BogCheckbox";
import BogTable, {
  type ColumnHeaderCellContent,
  type RowCellContent,
  type TableRow,
} from "@/components/bog/BogTable/BogTable";
import BogModal from "@/components/bog/BogModal/BogModal";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogIcon from "@/components/bog/BogIcon/BogIcon";

interface MemberRow {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  createdAt: Date;
}

interface ActivityData {
  totalHours: number;
  lastActive: string | null;
}

interface MembersTableProps {
  members: MemberRow[];
  total: number;
  page: number;
  pageSize: number;
  organizationId: string;
  currentUserId: string;
}

interface ColumnConfig {
  key: string;
  label: string;
  datatype: "string" | "string[]" | "number" | "number[]" | "other";
  weight: number;
  alwaysVisible?: boolean;
}

const COLUMNS: ColumnConfig[] = [
  {
    key: "checkbox",
    label: "",
    datatype: "other",
    weight: 0,
    alwaysVisible: true,
  },
  { key: "member", label: "Member", datatype: "string", weight: 20 },
  { key: "role", label: "Role", datatype: "string", weight: 13 },
  { key: "contact", label: "Contact", datatype: "other", weight: 25 },
  { key: "hours", label: "Hours", datatype: "number", weight: 11 },
  { key: "lastActive", label: "Last Active", datatype: "string", weight: 20 },
];

const ALL_TOGGLEABLE_KEYS = COLUMNS.filter((c) => !c.alwaysVisible).map(
  (c) => c.key,
);

const CONTACT_SUB_KEYS = ["phone", "email"] as const;

const DEFAULT_VISIBLE = new Set([...ALL_TOGGLEABLE_KEYS, ...CONTACT_SUB_KEYS]);

export default function MembersTable({
  members,
  total,
  page,
  pageSize,
  organizationId,
  currentUserId,
}: MembersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activity, setActivity] = useState<Record<string, ActivityData>>({});
  const [activityLoading, setActivityLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<MemberRow | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsOpen]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(DEFAULT_VISIBLE),
  );
  const [pendingVisibility, setPendingVisibility] = useState<Set<string>>(
    () => new Set(DEFAULT_VISIBLE),
  );
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [batchRemoving, setBatchRemoving] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  const handleRemove = useCallback(
    async (memberEmail: string) => {
      setRemoving(memberEmail);
      try {
        await authClient.organization.removeMember({
          memberIdOrEmail: memberEmail,
          organizationId,
        });
        router.refresh();
      } finally {
        setRemoving(null);
      }
    },
    [organizationId, router],
  );

  const handleBatchRemove = useCallback(async () => {
    const selected = members.filter((m) => selectedRows.has(m.userId));
    if (selected.length === 0) return;
    setBatchRemoving(true);
    setBatchProgress({ done: 0, total: selected.length });
    try {
      for (let i = 0; i < selected.length; i++) {
        await authClient.organization.removeMember({
          memberIdOrEmail: selected[i].email,
          organizationId,
        });
        setBatchProgress({ done: i + 1, total: selected.length });
      }
      setSelectedRows(new Set());
      router.refresh();
    } finally {
      setBatchRemoving(false);
      setConfirmBatchDelete(false);
    }
  }, [members, selectedRows, organizationId, router]);

  const toggleRow = useCallback((userId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (members.length === 0) return;
    const userIds = members.map((m) => m.userId);
    setActivityLoading(true);
    api.members.activity
      .$get({ query: { userIds } })
      .then((res: Response) => res.json())
      .then((data: unknown) =>
        setActivity(data as Record<string, ActivityData>),
      )
      .catch(() => setActivity({}))
      .finally(() => setActivityLoading(false));
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.phoneNumber ?? "").includes(q),
    );
  }, [members, search]);

  const allSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((m) => selectedRows.has(m.userId));

  const someSelected =
    !allSelected && filteredMembers.some((m) => selectedRows.has(m.userId));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredMembers.map((m) => m.userId)));
    }
  }, [allSelected, filteredMembers]);

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`?${params.toString()}`);
  }

  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);
  const hasSelection = selectedRows.size > 0;

  const visibleIndices = useMemo(
    () =>
      COLUMNS.reduce<number[]>((acc, col, i) => {
        if (col.alwaysVisible || visibleColumns.has(col.key)) acc.push(i);
        return acc;
      }, []),
    [visibleColumns],
  );

  const totalWeight = useMemo(
    () => visibleIndices.reduce((sum, i) => sum + COLUMNS[i].weight, 0),
    [visibleIndices],
  );

  const filteredColumnHeaders: ColumnHeaderCellContent[] = useMemo(
    () =>
      visibleIndices.map((i) => {
        const col = COLUMNS[i];
        const width =
          col.key === "checkbox"
            ? "55px"
            : `calc((100% - 55px) * ${col.weight} / ${totalWeight})`;
        return {
          content: col.label,
          datatype: col.datatype,
          styleProps: { style: { width } },
        };
      }),
    [visibleIndices, totalWeight],
  );

  const rows: TableRow[] = useMemo(
    () =>
      filteredMembers.map((member) => {
        const act = activity[member.userId];
        const hours = activityLoading || !act ? "—" : `${act.totalHours}hrs`;
        const lastActive =
          activityLoading || !act || !act.lastActive
            ? "—"
            : formatDate(act.lastActive);
        const isSelected = selectedRows.has(member.userId);
        const isSelf = member.userId === currentUserId;
        const isAdmin = member.role === "admin" || member.role === "owner";

        const allCells: RowCellContent[] = [
          {
            content: (
              <BogCheckbox
                name={member.userId}
                checked={isSelected}
                onCheckedChange={() => toggleRow(member.userId)}
              />
            ),
          },
          {
            content: (
              <div className="flex items-center gap-4">
                <div className="shrink-0 w-[39px] h-[39px] rounded-full bg-grey-off-state" />
                <span className="text-grey-text-weak">{member.name}</span>
              </div>
            ),
          },
          {
            content: (
              <div
                className={`inline-flex items-center justify-center rounded-[10px] px-3 py-1 ${
                  isAdmin ? "bg-brand-text" : "bg-status-active"
                }`}
              >
                <span className="font-semibold text-white whitespace-nowrap">
                  {isAdmin ? "Admin" : "Member"}
                </span>
              </div>
            ),
          },
          {
            content: (
              <div className="flex flex-col">
                {visibleColumns.has("phone") && member.phoneNumber && (
                  <span className="text-grey-text-weak">
                    Phone: {member.phoneNumber}
                  </span>
                )}
                {visibleColumns.has("email") && (
                  <span className="text-grey-text-weak">
                    Email: {member.email}
                  </span>
                )}
              </div>
            ),
          },
          {
            content: <span className="text-grey-text-weak">{hours}</span>,
          },
          {
            content: isSelected ? (
              <span className="text-grey-text-weak">{lastActive}</span>
            ) : (
              <>
                <span className="block text-grey-text-weak group-hover:hidden [@media(hover:none)]:hidden">
                  {lastActive}
                </span>
                <div className="hidden group-hover:flex [@media(hover:none)]:flex items-center gap-5">
                  <button
                    onClick={() => setConfirmTarget(member)}
                    disabled={isSelf || removing === member.email}
                    aria-label={`Remove ${member.name}`}
                    className="cursor-pointer focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                  >
                    <BogIcon
                      name="trash"
                      size={20}
                      color="var(--color-grey-stroke-strong)"
                    />
                  </button>
                  <button
                    aria-label={`Email ${member.name}`}
                    className="cursor-pointer focus:outline-none leading-none"
                  >
                    <BogIcon
                      name="chats"
                      size={20}
                      color="var(--color-grey-stroke-strong)"
                    />
                  </button>
                  <button
                    aria-label={`Edit ${member.name}`}
                    className="cursor-pointer focus:outline-none leading-none"
                  >
                    <PencilSimpleIcon
                      size={20}
                      color="var(--color-grey-stroke-strong)"
                    />
                  </button>
                </div>
              </>
            ),
          },
        ];

        return {
          styleProps: {
            className: isSelected
              ? "group bg-brand-fill"
              : "group hover:bg-brand-fill",
          },
          cells: visibleIndices.map((i) => allCells[i]),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      filteredMembers,
      activity,
      activityLoading,
      selectedRows,
      currentUserId,
      removing,
      visibleIndices,
      visibleColumns,
    ],
  );

  return (
    <div className="flex flex-col gap-5">
      <BogModal
        size="small"
        openState={{
          open: confirmTarget !== null,
          setOpen: (o) => {
            if (!o) setConfirmTarget(null);
          },
        }}
        contentProps={{ className: "confirm-modal" }}
        trigger={<span />}
        title={
          <p className="!text-desktop-paragraph-2 !leading-[22px] !font-bold !font-paragraph text-grey-text-strong">
            Please Confirm Deletion
          </p>
        }
        description={
          <p className="!text-mobile-paragraph-2 !leading-[20px] !font-paragraph text-grey-text-weak">
            Deleted members can&apos;t be restored. If you want to keep this
            member&apos;s record, set their status to <strong>Inactive</strong>{" "}
            instead.
          </p>
        }
        primaryLabel="Set to Inactive"
        secondaryLabel="Delete"
        onPrimary={() => setConfirmTarget(null)}
        onSecondary={async () => {
          if (confirmTarget) await handleRemove(confirmTarget.email);
          setConfirmTarget(null);
        }}
      />

      <BogModal
        size="small"
        openState={{
          open: confirmBatchDelete,
          setOpen: (o) => {
            if (!o && !batchRemoving) setConfirmBatchDelete(false);
          },
        }}
        contentProps={{ className: "confirm-modal" }}
        trigger={<span />}
        title={
          <p className="!text-desktop-paragraph-2 !leading-[22px] !font-bold !font-paragraph text-grey-text-strong">
            Delete {selectedRows.size} Member
            {selectedRows.size !== 1 ? "s" : ""}?
          </p>
        }
        description={
          <p className="!text-mobile-paragraph-2 !leading-[20px] !font-paragraph text-grey-text-weak">
            {batchRemoving
              ? `Deleting ${batchProgress.done} of ${batchProgress.total}...`
              : `Are you sure you want to delete ${selectedRows.size} selected member${selectedRows.size !== 1 ? "s" : ""}? This action cannot be undone.`}
          </p>
        }
        primaryLabel="Cancel"
        secondaryLabel="Delete"
        onPrimary={() => {
          if (!batchRemoving) setConfirmBatchDelete(false);
        }}
        onSecondary={handleBatchRemove}
        primaryDisabled={batchRemoving}
      />

      {/* Heading */}
      <div className="flex items-center gap-4">
        <BogIcon
          name="users"
          size={40}
          weight="fill"
          color="var(--color-dark-500)"
          className="shrink-0"
        />
        <h1
          className="whitespace-nowrap font-paragraph text-dark-500"
          style={{ fontWeight: 700, fontSize: 32, letterSpacing: "-0.32px" }}
        >
          Member Directory
        </h1>
      </div>

      {/* Search bar + Settings button */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center overflow-hidden h-[42px] border border-grey-stroke-weak rounded-[6px]">
          <input
            type="text"
            placeholder="Enter text to search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 h-full px-2 bg-transparent focus:outline-none text-mobile-paragraph-2 text-grey-text-weak"
          />
          <div className="flex items-center justify-center shrink-0 w-10 h-full">
            <BogIcon
              name="search"
              size={14}
              color="var(--color-grey-stroke-strong)"
            />
          </div>
        </div>
        <div ref={settingsRef} className="relative">
          <button
            onClick={() => {
              const opening = !settingsOpen;
              setSettingsOpen(opening);
              if (opening) setPendingVisibility(new Set(visibleColumns));
            }}
            className="flex items-center shrink-0 cursor-pointer h-[42px] border border-brand-stroke-strong rounded px-2 gap-1 shadow-inner"
          >
            <span className="font-semibold text-desktop-paragraph-2 text-brand-text whitespace-nowrap px-1">
              Settings
            </span>
            <BogIcon
              name="funnel-simple"
              size={20}
              color="var(--color-brand-text)"
            />
          </button>
          {settingsOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[431px] bg-white border border-grey-stroke-weak rounded-[8px] p-[24px] flex flex-col gap-[12px] shadow-[0px_8px_8px_-4px_rgba(0,0,0,0.04),0px_20px_24px_-4px_rgba(0,0,0,0.08)] z-50">
              <p
                className="font-paragraph text-[20px] leading-[28px] text-black"
                style={{ fontWeight: 700 }}
              >
                Dropdown Visibility
              </p>
              <div className="bg-[#f9f9f9] border border-grey-stroke-weak rounded-[4px] p-[4px] flex flex-col">
                {ALL_TOGGLEABLE_KEYS.map((key) => {
                  const col = COLUMNS.find((c) => c.key === key)!;
                  const isContact = key === "contact";
                  return (
                    <div key={key}>
                      <div className="h-[44px] flex items-center px-[8px] py-[12px] rounded-[4px] gap-[8px]">
                        <BogCheckbox
                          name={`visibility-${key}`}
                          label={col.label}
                          checked={pendingVisibility.has(key)}
                          onCheckedChange={() => {
                            setPendingVisibility((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) {
                                next.delete(key);
                                if (isContact) {
                                  next.delete("phone");
                                  next.delete("email");
                                }
                              } else {
                                next.add(key);
                                if (isContact) {
                                  next.add("phone");
                                  next.add("email");
                                }
                              }
                              return next;
                            });
                          }}
                        />
                      </div>
                      {isContact &&
                        CONTACT_SUB_KEYS.map((sub) => (
                          <div
                            key={sub}
                            className="h-[44px] flex items-center px-[24px] py-[12px] rounded-[4px] gap-[8px]"
                          >
                            <BogCheckbox
                              name={`visibility-${sub}`}
                              label={sub === "phone" ? "Phone" : "Email"}
                              checked={pendingVisibility.has(sub)}
                              onCheckedChange={() => {
                                setPendingVisibility((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(sub)) {
                                    next.delete(sub);
                                    const otherSub =
                                      sub === "phone" ? "email" : "phone";
                                    if (!next.has(otherSub)) {
                                      next.delete("contact");
                                    }
                                  } else {
                                    next.add(sub);
                                    next.add("contact");
                                  }
                                  return next;
                                });
                              }}
                            />
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between">
                <BogButton
                  variant="secondary"
                  size="medium"
                  className="px-[16px]"
                  onClick={() => {
                    setPendingVisibility(new Set(visibleColumns));
                    setSettingsOpen(false);
                  }}
                >
                  Cancel
                </BogButton>
                <BogButton
                  variant="primary"
                  size="medium"
                  className="px-[24px]"
                  onClick={() => {
                    setVisibleColumns(new Set(pendingVisibility));
                    setSettingsOpen(false);
                  }}
                >
                  Save
                </BogButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar: select-all checkbox + bulk/add actions */}
      <div className="flex items-center h-6 pl-4 gap-4">
        <div className="flex items-center gap-[5px]">
          <BogCheckbox
            name="select-all"
            checked={
              allSelected ? true : someSelected ? "indeterminate" : false
            }
            onCheckedChange={() => toggleSelectAll()}
          />
          <BogIcon
            name="caret-down"
            size={10}
            weight="fill"
            color="var(--color-grey-stroke-strong)"
          />
        </div>

        {hasSelection ? (
          <>
            <button
              aria-label="Delete selected"
              className="cursor-pointer leading-none"
              onClick={() => setConfirmBatchDelete(true)}
            >
              <BogIcon
                name="trash"
                size={20}
                color="var(--color-grey-icon-strong)"
              />
            </button>
            <button
              aria-label="Email selected"
              className="cursor-pointer leading-none"
            >
              <BogIcon
                name="chats"
                size={20}
                color="var(--color-grey-icon-strong)"
              />
            </button>
          </>
        ) : (
          <button
            aria-label="Add member"
            className="cursor-pointer leading-none"
          >
            <UserPlusIcon
              size={24}
              weight="regular"
              color="var(--color-grey-text-weak)"
            />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="members-table w-full">
        <BogTable columnHeaders={filteredColumnHeaders} rows={rows} />
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-mobile-paragraph-2 text-grey-stroke-strong">
            Showing {startItem}–{endItem} of {total} member
            {total !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-3">
            <button
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="flex items-center gap-1 cursor-pointer focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed text-mobile-paragraph-2 text-grey-text-weak border border-grey-stroke-weak rounded px-3 py-1.5"
            >
              <BogIcon name="caret-left" size={12} weight="bold" />
              Previous
            </button>
            <span className="text-mobile-paragraph-2 text-grey-text-strong">
              Page {page} of {totalPages}
            </span>
            <button
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="flex items-center gap-1 cursor-pointer focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed text-mobile-paragraph-2 text-grey-text-weak border border-grey-stroke-weak rounded px-3 py-1.5"
            >
              Next
              <BogIcon name="caret-right" size={12} weight="bold" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
