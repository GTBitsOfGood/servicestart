"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BogTable, {
  ColumnHeaderCellContent,
  TableRow,
} from "@/components/bog/BogTable/BogTable";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
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

function displayRole(role: string): string {
  if (role === "admin" || role === "owner") return "Admin";
  return "Member";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const columnHeaders: ColumnHeaderCellContent[] = [
  { content: "Member", datatype: "string" },
  { content: "Role", datatype: "string" },
  { content: "Contact", datatype: "string" },
  { content: "Hours", datatype: "number" },
  { content: "Last Active", datatype: "string" },
  { content: "", datatype: "other" },
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (members.length === 0) return;

    const userIds = members.map((m) => m.userId);
    setActivityLoading(true);

    api.members.activity
      .$get({ query: { userIds } })
      .then((res: Response) => res.json())
      .then((data: unknown) => {
        setActivity(data as Record<string, ActivityData>);
      })
      .catch(() => {
        setActivity({});
      })
      .finally(() => {
        setActivityLoading(false);
      });
  }, [members]);

  const rows: TableRow[] = useMemo(
    () =>
      members.map((member) => {
        const act = activity[member.userId];
        const hours = activityLoading || !act ? "—" : `${act.totalHours}h`;
        const lastActive =
          activityLoading || !act || !act.lastActive
            ? "—"
            : formatDate(act.lastActive);

        return {
          cells: [
            { content: member.name },
            { content: displayRole(member.role) },
            {
              content: (
                <div className="flex flex-col gap-0.5">
                  <span>{member.email}</span>
                  {member.phoneNumber && (
                    <span className="text-grey-stroke-strong">
                      {member.phoneNumber}
                    </span>
                  )}
                </div>
              ),
            },
            { content: hours },
            { content: lastActive },
            {
              content: (
                <button
                  onClick={() => handleRemove(member.email)}
                  disabled={
                    member.userId === currentUserId || removing === member.email
                  }
                  aria-label={`Remove ${member.name}`}
                  className="w-[22px] h-[24px] flex items-center justify-center text-grey-icon-weak hover:text-status-red-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <BogIcon name="trash" size={16} />
                </button>
              ),
            },
          ],
        };
      }),
    [members, activity, activityLoading, currentUserId, handleRemove, removing],
  );

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`?${params.toString()}`);
  }

  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div>
      <BogTable columnHeaders={columnHeaders} rows={rows} size="responsive" />

      {total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-paragraph-2 text-grey-stroke-strong">
            Showing {startItem}–{endItem} of {total} member
            {total !== 1 ? "s" : ""}
          </p>

          <div className="flex items-center gap-3">
            <BogButton
              variant="secondary"
              size="small"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              aria-label="Previous page"
            >
              <BogIcon name="caret-left" size={14} />
              Previous
            </BogButton>

            <span className="text-paragraph-2 text-black">
              Page {page} of {totalPages}
            </span>

            <BogButton
              variant="secondary"
              size="small"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              aria-label="Next page"
            >
              Next
              <BogIcon name="caret-right" size={14} />
            </BogButton>
          </div>
        </div>
      )}
    </div>
  );
}
