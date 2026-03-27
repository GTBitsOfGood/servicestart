"use client";

import Link from "next/link";
import { useState } from "react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogModal from "@/components/bog/BogModal/BogModal";
import { cn, formatTime } from "@/lib/utils";
import NotificationTag from "./NotificationTag";
import { JoinRequestStatus } from "@/lib/schema";

export interface NotificationListItem {
  id: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  read: boolean;
  type: string;
  text: string;
}

export interface JoinRequestExtras {
  status: JoinRequestStatus;
  user: {
    id: string;
    name: string;
    email: string;
  };
  denialReason?: string | null;
  organization: string;
  history?: Array<{
    id: string;
    action: string;
    resolvedByName: string | null;
    resolvedAt: Date | string;
    denialReason?: string | null;
  }>;
}

interface NotificationItemProps {
  notification: NotificationListItem;
  joinRequest?: JoinRequestExtras;
  onDelete?: (id: string) => void;
  onToggleRead?: (id: string, read: boolean) => void;
  onApprove?: (id: string) => void;
  onDeny?: (id: string, reason: string) => void;
  onRemoveAccess?: (id: string) => void;
  compact?: boolean;
  hideTag?: boolean;
}

export default function NotificationItem({
  notification,
  joinRequest,
  onDelete,
  onToggleRead,
  onApprove,
  onDeny,
  onRemoveAccess,
  compact = false,
  hideTag = false,
}: NotificationItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);

  const title = notification.text.split("\n")[0];
  const body = notification.text.slice(notification.text.indexOf("\n") + 1);

  const isPending = joinRequest?.status === JoinRequestStatus.Pending;
  const isApproved = joinRequest?.status === JoinRequestStatus.Approved;
  const isDenied = joinRequest?.status === JoinRequestStatus.Denied;

  const showActions = !!onDelete || !!onToggleRead;

  const actionButtons = (
    <div className="flex items-center gap-1">
      {onDelete && (
        <button
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(notification.id);
          }}
          className="rounded p-1 text-grey-icon-weak hover:bg-grey-fill-weak hover:text-grey-text-strong"
          title="Delete"
          type="button"
        >
          <BogIcon name="trash" size={compact ? 18 : 22} />
        </button>
      )}

      {onToggleRead && (
        <button
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleRead(notification.id, !notification.read);
          }}
          className="rounded p-1 text-grey-icon-weak hover:bg-grey-fill-weak hover:text-grey-text-strong"
          title={notification.read ? "Mark as unread" : "Mark as read"}
          type="button"
        >
          <BogIcon name="envelope" size={compact ? 18 : 22} />
        </button>
      )}
    </div>
  );

  const renderJoinRequestButtons = (stacked = false) => {
    if (!joinRequest) return null;
    if (isPending) {
      return (
        <div
          className={cn(
            "flex gap-2",
            stacked ? "flex-col items-end" : "items-center gap-3",
          )}
        >
          <BogButton
            variant="secondary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDenyOpen(true);
            }}
            className="w-[90px] justify-center !rounded-md !px-0 !py-1 !text-[12px]"
          >
            Deny
          </BogButton>
          <BogButton
            variant="primary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setApproveOpen(true);
            }}
            className="w-[90px] justify-center !rounded-md !px-0 !py-1 !text-[12px]"
          >
            Approve
          </BogButton>
        </div>
      );
    }
    if (isApproved) {
      return (
        <div
          className={cn(
            "flex flex-nowrap gap-2",
            stacked ? "flex-col items-end" : "items-center gap-3",
          )}
        >
          <span className="inline-flex w-[110px] flex-shrink-0 items-center justify-center gap-1 rounded-md border border-transparent bg-grey-icon-weak py-1 px-1 text-[12px] font-semibold text-white whitespace-nowrap">
            Approved ✓
          </span>
          {onRemoveAccess && (
            <BogButton
              variant="primary"
              className="w-[110px] flex-shrink-0 whitespace-nowrap justify-center !rounded-md !px-1 !py-1 !text-[12px]"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemoveAccess(notification.id);
              }}
            >
              Remove Access
            </BogButton>
          )}
        </div>
      );
    }
    if (isDenied) {
      return (
        <div
          className={cn(
            "flex flex-nowrap gap-2",
            stacked ? "flex-col items-end" : "items-center gap-3",
          )}
        >
          <span className="inline-flex w-[110px] flex-shrink-0 items-center justify-center gap-1 rounded-md border border-transparent bg-grey-icon-weak py-1 text-[12px] font-semibold text-white whitespace-nowrap">
            Denied ✕
          </span>
          <BogButton
            variant="primary"
            className="w-[110px] flex-shrink-0 whitespace-nowrap justify-center !rounded-md !px-0 !py-1 !text-[12px]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setApproveOpen(true);
            }}
          >
            Approve
          </BogButton>
        </div>
      );
    }
    return null;
  };

  const modals = joinRequest && (
    <>
      <BogModal
        openState={{ open: approveOpen, setOpen: setApproveOpen }}
        title={<h3>Approve Request</h3>}
        description={
          <span>
            Once this request is approved, the requester will be notified and
            will have access to {joinRequest.organization}
          </span>
        }
        primaryLabel="Approve"
        secondaryLabel="Cancel"
        buttonsContainerClassName="!justify-between w-full"
        onPrimary={() => {
          setApproveOpen(false);
          onApprove?.(notification.id);
        }}
        trigger={<div className="hidden" />}
      />

      <BogModal
        openState={{ open: denyOpen, setOpen: setDenyOpen }}
        title={<h3>Deny Request</h3>}
        description={
          <span>
            Once this request is denied, the requester will be notified and will
            not have access to {joinRequest.organization}
            <div className="mt-4 flex flex-col gap-1 text-left">
              <label className="text-[13px] font-medium text-grey-text-strong">
                Required Reasoning
              </label>
              <textarea
                className="w-full rounded border border-grey-stroke-weak bg-grey-fill-weaker px-3 py-2 text-[12px] text-grey-text-strong placeholder:text-grey-text-weak focus:outline-none focus:ring-1 focus:ring-brand-text"
                rows={3}
                placeholder="Enter reasoning for denial here."
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
              />
            </div>
          </span>
        }
        primaryLabel="Deny"
        secondaryLabel="Cancel"
        primaryDisabled={!denyReason.trim()}
        buttonsContainerClassName="!justify-between w-full"
        onPrimary={() => {
          setDenyOpen(false);
          onDeny?.(notification.id, denyReason);
          setDenyReason("");
        }}
        onSecondary={() => {
          setDenyOpen(false);
          setDenyReason("");
        }}
        trigger={<div className="hidden" />}
      />
    </>
  );

  if (compact) {
    return (
      <Link
        href={`/inbox/${notification.id}`}
        className="group block border-t border-grey-stroke-weak first:border-t-0"
      >
        <div
          className={cn(
            "relative flex flex-col gap-1.5 px-14 py-10 transition-colors hover:bg-grey-fill-weaker",
            !notification.read && "bg-notif-unread-bg",
          )}
        >
          {!notification.read && (
            <div
              className="absolute left-5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-brand-text"
              aria-hidden
            />
          )}

          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-3">
              {!hideTag && (
                <NotificationTag type={notification.type} variant="text" />
              )}
              <div className="relative flex items-center">
                <span
                  className={cn(
                    "whitespace-nowrap text-paragraph-2 text-grey-text-weak transition-opacity",
                    showActions &&
                      "group-hover:opacity-0 group-focus-within:opacity-0",
                  )}
                >
                  {formatTime(notification.createdAt)}
                </span>

                {showActions && (
                  <div className="pointer-events-none absolute right-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                    {actionButtons}
                  </div>
                )}
              </div>
            </div>

            <p className="text-paragraph-1 font-semibold text-grey-text-strong">
              {title}
            </p>
          </div>

          <p className="line-clamp-2 text-paragraph-2 text-grey-text-weak">
            {body}
          </p>
        </div>
      </Link>
    );
  }

  const innerContent = (
    <div
      className={cn(
        "relative px-14 py-10 transition-colors hover:bg-grey-fill-weaker",
        !notification.read && "bg-notif-unread-bg",
      )}
    >
      {!notification.read && (
        <div
          className="absolute left-5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-brand-text"
          aria-hidden
        />
      )}

      <div className="flex flex-col gap-3">
        {!hideTag && (
          <div className="flex items-center justify-between gap-3">
            <NotificationTag type={notification.type} variant="light" />
            <div className="relative flex items-center">
              <span
                className={cn(
                  "whitespace-nowrap text-paragraph-2 text-grey-text-weak transition-opacity",
                  showActions &&
                    "group-hover:opacity-0 group-focus-within:opacity-0",
                )}
              >
                {formatTime(notification.createdAt)}
              </span>

              {showActions && (
                <div className="pointer-events-none absolute right-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  {actionButtons}
                </div>
              )}
            </div>
          </div>
        )}
        {hideTag && (
          <div className="flex items-center justify-between gap-3">
            <span
              className={cn(
                "whitespace-nowrap text-paragraph-2 text-grey-text-weak transition-opacity",
                showActions &&
                  "group-hover:opacity-0 group-focus-within:opacity-0",
              )}
            >
              {formatTime(notification.createdAt)}
            </span>
            <div className="relative flex items-center">
              {showActions && (
                <div className="pointer-events-none absolute right-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  {actionButtons}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex w-full items-start justify-between gap-8">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-paragraph-1 font-semibold text-grey-text-strong">
              {title}
            </p>

            {!joinRequest && (
              <p className="line-clamp-2 text-paragraph-2 text-grey-text-weak">
                {body}
              </p>
            )}

            {joinRequest && !expanded && (
              <div className="mt-2 flex items-end justify-start">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpanded(true);
                  }}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-text hover:opacity-80"
                >
                  View Details
                  <BogIcon
                    name="chevron-right"
                    size={12}
                    color="var(--color-brand-text)"
                  />
                </button>
              </div>
            )}
          </div>

          <div className="flex w-[120px] shrink-0 items-start justify-end">
            {expanded ? (
              <div className="invisible">{renderJoinRequestButtons(true)}</div>
            ) : (
              renderJoinRequestButtons(true)
            )}
          </div>
        </div>

        {joinRequest && expanded && (
          <div className="mb-0 mt-1 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-1">
                <p className="text-small leading-tight font-semibold text-grey-text-strong uppercase tracking-wide">
                  Requester Info
                </p>
                <ul className="ml-4 list-disc marker:text-grey-text-weak !text-[8px] leading-tight text-grey-text-weak">
                  <li className="text-small leading-tight">
                    Name: {joinRequest.user.name ?? "—"}
                  </li>
                  <li className="text-small leading-tight">
                    Email: {joinRequest.user.email ?? "—"}
                  </li>
                </ul>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-small leading-tight font-semibold text-grey-text-strong uppercase tracking-wide">
                  Requester History
                </p>
                <ul className="ml-4 list-disc marker:text-grey-text-weak !text-[8px] leading-tight text-grey-text-weak">
                  {joinRequest.history && joinRequest.history.length > 0 ? (
                    joinRequest.history.map((entry) => (
                      <li key={entry.id} className="text-small leading-tight">
                        {entry.action.charAt(0).toUpperCase() +
                          entry.action.slice(1)}{" "}
                        access —{" "}
                        {new Date(entry.resolvedAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "2-digit",
                            day: "2-digit",
                            year: "2-digit",
                          },
                        )}
                      </li>
                    ))
                  ) : (
                    <li className="text-small leading-tight">
                      No request history
                    </li>
                  )}
                </ul>
              </div>
            </div>
            {joinRequest.denialReason && (
              <div className="flex flex-col gap-1">
                <p className="text-small leading-tight font-semibold text-grey-text-strong uppercase tracking-wide">
                  Reason for Denial
                </p>
                <p className="text-small leading-tight text-grey-text-weak">
                  {joinRequest.denialReason}
                </p>
              </div>
            )}
            {joinRequest.history && joinRequest.history.length > 0 && (
              <p className="text-small italic text-grey-text-weak">
                {joinRequest.history[0].action.charAt(0).toUpperCase() +
                  joinRequest.history[0].action.slice(1)}{" "}
                by {joinRequest.history[0].resolvedByName}
                {" — "}
                {new Date(joinRequest.history[0].resolvedAt).toLocaleDateString(
                  "en-US",
                  {
                    month: "2-digit",
                    day: "2-digit",
                    year: "2-digit",
                  },
                )}
                .
              </p>
            )}
          </div>
        )}

        {joinRequest && expanded && (
          <div className="mt-4 flex w-full items-center justify-between">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(false);
              }}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-text hover:opacity-80"
            >
              View Details
              <BogIcon
                name="chevron-up"
                size={12}
                color="var(--color-brand-text)"
              />
            </button>
            <div className="flex items-center gap-3">
              {renderJoinRequestButtons(false)}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (joinRequest) {
    return (
      <>
        {modals}
        <div className="border-t border-grey-stroke-weak first:border-t-0">
          {innerContent}
        </div>
      </>
    );
  }

  return (
    <>
      {modals}
      <Link
        href={`/inbox/${notification.id}`}
        className="group block border-t border-grey-stroke-weak first:border-t-0"
      >
        {innerContent}
      </Link>
    </>
  );
}
