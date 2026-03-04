"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PencilSimple, UserPlus } from "@phosphor-icons/react";
import api from "@/lib/api";
import authClient from "@/lib/authClient";
import { formatDate } from "@/lib/clientUtils";
import BogCheckbox from "@/components/bog/BogCheckbox/BogCheckbox";
import BogTable, {
  type ColumnHeaderCellContent,
  type TableRow,
} from "@/components/bog/BogTable/BogTable";
import BogModal from "@/components/bog/BogModal/BogModal";
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

const COLUMN_HEADERS: ColumnHeaderCellContent[] = [
  { content: "", datatype: "other", styleProps: { style: { width: "55px" } } },
  {
    content: "Member",
    datatype: "string",
    styleProps: { style: { width: "calc((100% - 55px) * 20 / 89)" } },
  },
  {
    content: "Role",
    datatype: "string",
    styleProps: { style: { width: "calc((100% - 55px) * 13 / 89)" } },
  },
  {
    content: "Contact",
    datatype: "other",
    styleProps: { style: { width: "calc((100% - 55px) * 25 / 89)" } },
  },
  {
    content: "Hours",
    datatype: "number",
    styleProps: { style: { width: "calc((100% - 55px) * 11 / 89)" } },
  },
  {
    content: "Last Active",
    datatype: "string",
    styleProps: { style: { width: "calc((100% - 55px) * 20 / 89)" } },
  },
];

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

        return {
          styleProps: {
            className: isSelected
              ? "group bg-brand-fill"
              : "group hover:bg-brand-fill",
          },
          cells: [
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
                  {member.phoneNumber && (
                    <span className="text-grey-text-weak">
                      Phone: {member.phoneNumber}
                    </span>
                  )}
                  <span className="text-grey-text-weak">
                    Email: {member.email}
                  </span>
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
                      <PencilSimple
                        size={20}
                        color="var(--color-grey-stroke-strong)"
                      />
                    </button>
                  </div>
                </>
              ),
            },
          ],
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
        contentProps={{ className: "confirm-delete-modal" }}
        trigger={<span />}
        title={
          <p
            style={{
              fontSize: "16px",
              lineHeight: "20px",
              fontWeight: 700,
              fontFamily: "var(--font-paragraph)",
              color: "var(--color-grey-text-strong)",
            }}
          >
            Please Confirm Deletion
          </p>
        }
        description={
          <p
            style={{
              fontSize: "12px",
              lineHeight: "16px",
              fontWeight: 400,
              fontFamily: "var(--font-paragraph)",
              color: "var(--color-grey-text-weak)",
            }}
          >
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

      {/* Heading */}
      <div className="flex items-center gap-4">
        <BogIcon
          name="users"
          size={40}
          weight="fill"
          color="var(--color-dark-500)"
          className="shrink-0"
        />
        <h1 className="whitespace-nowrap font-bold font-paragraph text-[32px] leading-none tracking-[-0.32px] text-dark-500">
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
            className="flex-1 h-full px-2 bg-transparent focus:outline-none text-[14px] text-grey-text-weak"
          />
          <div className="flex items-center justify-center shrink-0 w-10 h-full">
            <BogIcon
              name="search"
              size={14}
              color="var(--color-grey-stroke-strong)"
            />
          </div>
        </div>
        <button className="flex items-center shrink-0 cursor-pointer h-[42px] border border-brand-stroke-strong rounded px-2 gap-1 shadow-[inset_0px_1px_1px_0px_rgba(0,0,0,0.25)]">
          <span className="font-semibold text-[16px] text-brand-text whitespace-nowrap px-1">
            Settings
          </span>
          <BogIcon
            name="funnel-simple"
            size={20}
            color="var(--color-brand-text)"
          />
        </button>
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
            <UserPlus
              size={24}
              weight="regular"
              color="var(--color-grey-text-weak)"
            />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="members-table w-full">
        <BogTable columnHeaders={COLUMN_HEADERS} rows={rows} />
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[14px] text-grey-stroke-strong">
            Showing {startItem}–{endItem} of {total} member
            {total !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-3">
            <button
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="flex items-center gap-1 cursor-pointer focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed text-[14px] text-grey-text-weak border border-grey-stroke-weak rounded px-3 py-1.5"
            >
              <BogIcon name="caret-left" size={12} weight="bold" />
              Previous
            </button>
            <span className="text-[14px] text-grey-text-strong">
              Page {page} of {totalPages}
            </span>
            <button
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="flex items-center gap-1 cursor-pointer focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed text-[14px] text-grey-text-weak border border-grey-stroke-weak rounded px-3 py-1.5"
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
