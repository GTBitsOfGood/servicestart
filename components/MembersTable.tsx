"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Envelope,
  PencilSimple,
  Trash,
  UserPlus,
  CaretUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  SlidersHorizontal,
  Users,
} from "@phosphor-icons/react";
import api from "@/lib/api";
import authClient from "@/lib/authClient";

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

type SortField = "role" | "hours" | "lastActive" | null;
type SortDir = "asc" | "desc";

const FONT_STACK = '"Open Sans Regular", ui-sans-serif, system-ui, sans-serif';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function CustomCheckbox({
  checked,
  indeterminate = false,
  onChange,
  size = 24,
  disabled = false,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange?: () => void;
  size?: number;
  disabled?: boolean;
}) {
  const active = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      onClick={onChange}
      disabled={disabled}
      className="flex items-center justify-center shrink-0 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        width: size,
        height: size,
        backgroundColor: active ? "#fc5b43" : "white",
        border: `1px solid ${active ? "rgba(252,91,67,0.8)" : "rgba(34,7,11,0.1)"}`,
        borderRadius: 4,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {checked && !indeterminate && (
        <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
          <path
            d="M1.5 5L5 8.5L11.5 1.5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {indeterminate && (
        <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
          <line
            x1="0"
            y1="1"
            x2="10"
            y2="1"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}

function SorterIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
}) {
  const isActive = sortField === field;
  return (
    <div className="relative shrink-0" style={{ width: 11, height: 18 }}>
      <CaretUp
        size={9}
        weight="fill"
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
        }}
        color={isActive && sortDir === "asc" ? "#22070b" : "rgba(34,7,11,0.3)"}
      />
      <CaretDown
        size={9}
        weight="fill"
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
        }}
        color={isActive && sortDir === "desc" ? "#22070b" : "rgba(34,7,11,0.3)"}
      />
    </div>
  );
}

// No bg set on <td> — rows control background via <tr> class
const TH_BASE =
  "h-[56px] px-4 text-left align-middle text-[#22070b] bg-[rgba(34,7,11,0.03)] border-b border-[rgba(34,7,11,0.05)]";
const TD_BASE =
  "px-4 py-4 text-left align-middle border-b border-[rgba(34,7,11,0.05)]";

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
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField],
  );

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

  const filteredAndSortedMembers = useMemo(() => {
    let list = members;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.phoneNumber ?? "").includes(q),
      );
    }
    if (sortField) {
      list = [...list].sort((a, b) => {
        const actA = activity[a.userId];
        const actB = activity[b.userId];
        if (sortField === "role") {
          const roleA = a.role ?? "";
          const roleB = b.role ?? "";
          return sortDir === "asc"
            ? roleA.localeCompare(roleB)
            : roleB.localeCompare(roleA);
        }
        if (sortField === "hours") {
          const numA = actA?.totalHours ?? -1;
          const numB = actB?.totalHours ?? -1;
          return sortDir === "asc" ? numA - numB : numB - numA;
        }
        if (sortField === "lastActive") {
          const av = actA?.lastActive ?? "";
          const bv = actB?.lastActive ?? "";
          return sortDir === "asc"
            ? av.localeCompare(bv)
            : bv.localeCompare(av);
        }
        return 0;
      });
    }
    return list;
  }, [members, search, sortField, sortDir, activity]);

  const allSelected =
    filteredAndSortedMembers.length > 0 &&
    filteredAndSortedMembers.every((m) => selectedRows.has(m.userId));

  const someSelected =
    !allSelected &&
    filteredAndSortedMembers.some((m) => selectedRows.has(m.userId));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredAndSortedMembers.map((m) => m.userId)));
    }
  }, [allSelected, filteredAndSortedMembers]);

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`?${params.toString()}`);
  }

  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const hasSelection = selectedRows.size > 0;

  return (
    <div className="flex flex-col gap-5" style={{ fontFamily: FONT_STACK }}>
      {/* Heading */}
      <div className="flex items-end gap-4">
        <Users
          size={40}
          weight="fill"
          color="#3f3f3f"
          style={{ flexShrink: 0 }}
        />
        <p
          role="heading"
          aria-level={1}
          className="whitespace-nowrap"
          style={{
            fontFamily: FONT_STACK,
            fontWeight: 700,
            fontSize: 32,
            lineHeight: "normal",
            letterSpacing: "-0.32px",
            color: "#3f3f3f",
          }}
        >
          Member Directory
        </p>
      </div>

      {/* Search bar + Settings button */}
      <div className="flex items-center gap-3">
        <div
          className="flex flex-1 items-center overflow-hidden"
          style={{
            height: 42,
            border: "1px solid rgba(34,7,11,0.1)",
            borderRadius: 6,
          }}
        >
          <input
            type="text"
            placeholder="Enter text to search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 h-full px-2 bg-transparent focus:outline-none"
            style={{
              fontFamily: FONT_STACK,
              fontSize: 14,
              fontWeight: 400,
              lineHeight: "16px",
              color: "rgba(34,7,11,0.7)",
            }}
          />
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: 40, height: "100%" }}
          >
            <MagnifyingGlass
              size={13.5}
              weight="bold"
              color="rgba(34,7,11,0.5)"
            />
          </div>
        </div>
        <button
          className="flex items-center shrink-0"
          style={{
            height: 42,
            border: "1px solid rgba(252,91,67,0.8)",
            borderRadius: 4,
            paddingLeft: 8,
            paddingRight: 12,
            gap: 4,
            boxShadow: "inset 0px 1px 1px 0px rgba(0,0,0,0.25)",
            fontFamily: FONT_STACK,
          }}
        >
          <span
            style={{
              fontFamily: FONT_STACK,
              fontWeight: 600,
              fontSize: 16,
              lineHeight: "20px",
              color: "#fc5b43",
              whiteSpace: "nowrap",
              padding: "0 4px",
            }}
          >
            Settings
          </span>
          <SlidersHorizontal size={18} weight="regular" color="#fc5b43" />
        </button>
      </div>

      {/* Toolbar: select-all checkbox + bulk/add actions */}
      <div
        className="flex items-center"
        style={{ height: 24, paddingLeft: 16, gap: 16 }}
      >
        <div className="flex items-center" style={{ gap: 5 }}>
          <CustomCheckbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={toggleSelectAll}
          />
          <CaretDown size={10} weight="fill" color="rgba(34,7,11,0.5)" />
        </div>

        {hasSelection ? (
          <>
            <button aria-label="Delete selected" style={{ lineHeight: 0 }}>
              <Trash size={20} color="rgba(34,7,11,0.6)" />
            </button>
            <button aria-label="Email selected" style={{ lineHeight: 0 }}>
              <Envelope size={20} color="rgba(34,7,11,0.6)" />
            </button>
          </>
        ) : (
          <button aria-label="Add member" style={{ lineHeight: 0 }}>
            <UserPlus size={24} weight="regular" color="rgba(34,7,11,0.7)" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="w-full overflow-hidden">
        <table
          className="w-full"
          style={{ borderCollapse: "collapse", tableLayout: "fixed" }}
        >
          {/* Proportional column widths (55|200|200|215|200|200 = 1070px total) */}
          <colgroup>
            <col style={{ width: "5.14%" }} />
            <col style={{ width: "18.69%" }} />
            <col style={{ width: "18.69%" }} />
            <col style={{ width: "20.09%" }} />
            <col style={{ width: "18.69%" }} />
            <col style={{ width: "18.69%" }} />
          </colgroup>
          <thead>
            <tr>
              {/* Checkbox column — fixed 55 px, no header text */}
              <th className={TH_BASE} />

              {/* Member — no sorter */}
              <th
                className={`${TH_BASE} border-l border-[rgba(34,7,11,0.1)]`}
                style={{ fontFamily: FONT_STACK, fontWeight: 700 }}
              >
                <span className="flex-1 text-[16px] leading-[16px] font-bold">
                  Member
                </span>
              </th>

              {/* Role — sortable */}
              <th
                className={`${TH_BASE} border-l border-[rgba(34,7,11,0.1)] cursor-pointer select-none`}
                style={{ fontFamily: FONT_STACK, fontWeight: 700 }}
                onClick={() => toggleSort("role")}
              >
                <div className="flex items-center gap-1">
                  <span className="flex-1 text-[16px] leading-[16px] font-bold">
                    Role
                  </span>
                  <SorterIcon
                    field="role"
                    sortField={sortField}
                    sortDir={sortDir}
                  />
                </div>
              </th>

              {/* Contact — no sorter */}
              <th
                className={`${TH_BASE} border-l border-[rgba(34,7,11,0.1)]`}
                style={{ fontFamily: FONT_STACK, fontWeight: 700 }}
              >
                <span className="flex-1 text-[16px] leading-[16px] font-bold">
                  Contact
                </span>
              </th>

              {/* Hours — sortable */}
              <th
                className={`${TH_BASE} border-l border-[rgba(34,7,11,0.1)] cursor-pointer select-none`}
                style={{ fontFamily: FONT_STACK, fontWeight: 700 }}
                onClick={() => toggleSort("hours")}
              >
                <div className="flex items-center gap-1">
                  <span className="flex-1 text-[16px] leading-[16px] font-bold">
                    Hours
                  </span>
                  <SorterIcon
                    field="hours"
                    sortField={sortField}
                    sortDir={sortDir}
                  />
                </div>
              </th>

              {/* Last Active — sortable; action icons live here on hover */}
              <th
                className={`${TH_BASE} border-l border-[rgba(34,7,11,0.1)] cursor-pointer select-none`}
                style={{ fontFamily: FONT_STACK, fontWeight: 700 }}
                onClick={() => toggleSort("lastActive")}
              >
                <div className="flex items-center gap-1">
                  <span className="flex-1 text-[16px] leading-[16px] font-bold">
                    Last Active
                  </span>
                  <SorterIcon
                    field="lastActive"
                    sortField={sortField}
                    sortDir={sortDir}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedMembers.map((member) => {
              const act = activity[member.userId];
              const hours =
                activityLoading || !act ? "—" : `${act.totalHours}hrs`;
              const lastActive =
                activityLoading || !act || !act.lastActive
                  ? "—"
                  : formatDate(act.lastActive);
              const isSelected = selectedRows.has(member.userId);
              const isSelf = member.userId === currentUserId;

              // Row bg: selected OR hover both use brand-weak pink per Figma
              const rowClass = `group ${
                isSelected
                  ? "bg-[rgba(252,91,67,0.05)]"
                  : "bg-white hover:bg-[rgba(252,91,67,0.05)]"
              }`;

              const cellStyle: React.CSSProperties = {
                fontFamily: FONT_STACK,
                fontWeight: 400,
                fontSize: 14,
                lineHeight: "24px",
                color: "rgba(34,7,11,0.7)",
              };

              return (
                <tr key={member.userId} className={rowClass}>
                  {/* Checkbox */}
                  <td
                    className={TD_BASE}
                    style={{ width: 55, minWidth: 55, maxWidth: 55 }}
                  >
                    <div className="flex items-center justify-center">
                      <CustomCheckbox
                        checked={isSelected}
                        onChange={() => toggleRow(member.userId)}
                      />
                    </div>
                  </td>

                  {/* Member: avatar + name */}
                  <td className={TD_BASE} style={cellStyle}>
                    <div className="flex items-center" style={{ gap: 16 }}>
                      <div
                        className="shrink-0 rounded-full"
                        style={{
                          width: 39,
                          height: 39,
                          backgroundColor: "rgba(34,7,11,0.12)",
                        }}
                      />
                      <span className="text-[14px] leading-[24px]">
                        {member.name}
                      </span>
                    </div>
                  </td>

                  {/* Role */}
                  <td className={TD_BASE} style={cellStyle}>
                    {(() => {
                      const isAdmin =
                        member.role === "admin" || member.role === "owner";
                      return (
                        <div
                          className="inline-flex items-center justify-center"
                          style={{
                            backgroundColor: isAdmin ? "#fc5b43" : "#63cc80",
                            borderRadius: 10,
                            paddingLeft: 12,
                            paddingRight: 12,
                            paddingTop: 4,
                            paddingBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: FONT_STACK,
                              fontWeight: 600,
                              fontSize: 14,
                              lineHeight: "normal",
                              color: "white",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isAdmin ? "Admin" : "Member"}
                          </span>
                        </div>
                      );
                    })()}
                  </td>

                  {/* Contact */}
                  <td className={TD_BASE} style={cellStyle}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        lineHeight: "24px",
                      }}
                    >
                      {member.phoneNumber && (
                        <span className="text-[14px] leading-[24px]">
                          Phone: {member.phoneNumber}
                        </span>
                      )}
                      <span className="text-[14px] leading-[24px]">
                        Email: {member.email}
                      </span>
                    </div>
                  </td>

                  {/* Hours */}
                  <td className={TD_BASE} style={cellStyle}>
                    {hours}
                  </td>

                  {/* Last Active — date normally; action icons replace it on row hover */}
                  <td className={TD_BASE} style={cellStyle}>
                    {isSelected ? (
                      <span className="text-[14px] leading-[24px]">
                        {lastActive}
                      </span>
                    ) : (
                      <>
                        <span className="text-[14px] leading-[24px] block group-hover:hidden">
                          {lastActive}
                        </span>
                        <div className="hidden group-hover:flex items-center gap-5">
                          <button
                            onClick={() => handleRemove(member.email)}
                            disabled={isSelf || removing === member.email}
                            aria-label={`Remove ${member.name}`}
                            className="focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ lineHeight: 0 }}
                          >
                            <Trash size={20} color="rgba(34,7,11,0.5)" />
                          </button>
                          <button
                            aria-label={`Email ${member.name}`}
                            className="focus:outline-none"
                            style={{ lineHeight: 0 }}
                          >
                            <Envelope size={20} color="rgba(34,7,11,0.5)" />
                          </button>
                          <button
                            aria-label={`Edit ${member.name}`}
                            className="focus:outline-none"
                            style={{ lineHeight: 0 }}
                          >
                            <PencilSimple size={20} color="rgba(34,7,11,0.5)" />
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p
            style={{
              fontFamily: FONT_STACK,
              fontWeight: 400,
              fontSize: 14,
              color: "rgba(34,7,11,0.5)",
            }}
          >
            Showing {startItem}–{endItem} of {total} member
            {total !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-3">
            <button
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="flex items-center gap-1 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                fontFamily: FONT_STACK,
                fontWeight: 400,
                fontSize: 14,
                color: "rgba(34,7,11,0.7)",
                border: "1px solid rgba(34,7,11,0.1)",
                borderRadius: 4,
                padding: "6px 12px",
              }}
            >
              <CaretLeft size={12} weight="bold" />
              Previous
            </button>
            <span
              style={{
                fontFamily: FONT_STACK,
                fontWeight: 400,
                fontSize: 14,
                color: "#22070b",
              }}
            >
              Page {page} of {totalPages}
            </span>
            <button
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="flex items-center gap-1 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                fontFamily: FONT_STACK,
                fontWeight: 400,
                fontSize: 14,
                color: "rgba(34,7,11,0.7)",
                border: "1px solid rgba(34,7,11,0.1)",
                borderRadius: 4,
                padding: "6px 12px",
              }}
            >
              Next
              <CaretRight size={12} weight="bold" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
