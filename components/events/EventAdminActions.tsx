"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import BogButton from "@/components/bog/BogButton/BogButton";
import ExitIcon from "@/components/ExitIcon";

export type AdminActionResult = { ok: boolean; error?: string };

type EventAdminActionsProps = {
  eventId: string;
  isPublished: boolean;
  onTogglePublish: (publish: boolean) => Promise<AdminActionResult>;
  onDelete: () => Promise<AdminActionResult>;
};

export default function EventAdminActions({
  eventId,
  isPublished,
  onTogglePublish,
  onDelete,
}: EventAdminActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  function run(action: () => Promise<AdminActionResult>) {
    if (isPending) return;

    startTransition(async () => {
      setError("");
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Please retry.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        <Link
          href={`/events/${eventId}/edit`}
          className="inline-flex items-center rounded border border-brand-stroke-strong bg-white px-4 py-2 text-paragraph-2 font-semibold text-brand-text"
        >
          Edit
        </Link>
        <BogButton
          type="button"
          variant={isPublished ? "secondary" : "primary"}
          disabled={isPending}
          onClick={() => run(() => onTogglePublish(!isPublished))}
          className="rounded px-4 py-2 text-paragraph-2 font-semibold"
        >
          {isPublished
            ? isPending
              ? "Unpublishing…"
              : "Unpublish"
            : isPending
              ? "Publishing…"
              : "Publish"}
        </BogButton>
        <BogButton
          type="button"
          variant="tertiary"
          disabled={isPending}
          onClick={() => setShowConfirmDelete(true)}
          className="px-4 py-2 text-paragraph-2 font-semibold text-status-red-text"
        >
          Delete
        </BogButton>
      </div>
      {error && (
        <p role="alert" className="text-small text-status-red-text">
          {error}
        </p>
      )}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-1/3 flex-col items-center gap-4 rounded bg-solid-bg-base p-8">
            <div className="w-full">
              <div className="inline-flex w-full items-center justify-between">
                <h4>Delete event</h4>
                <BogButton
                  onClick={() => setShowConfirmDelete(false)}
                  className="bg-transparent"
                  aria-label="Close dialog"
                >
                  <ExitIcon />
                </BogButton>
              </div>
              <hr className="w-full border-media-divider" />
            </div>
            <p className="self-stretch">
              Deleting this event also removes its registrations. This cannot be
              undone.
            </p>
            <div className="flex items-start gap-5 self-end">
              <BogButton
                variant="tertiary"
                onClick={() => setShowConfirmDelete(false)}
              >
                Cancel
              </BogButton>
              <BogButton
                disabled={isPending}
                onClick={() => {
                  setShowConfirmDelete(false);
                  run(onDelete);
                }}
                className="flex items-center rounded px-3 py-2"
              >
                Delete event
              </BogButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
