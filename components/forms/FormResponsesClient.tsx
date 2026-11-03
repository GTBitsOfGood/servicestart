"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { SubmissionReviewStatus } from "@/lib/schema";
import {
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_CHIP_COLORS,
} from "@/lib/forms/review";
import type { FormReviewService } from "@/lib/services/FormReviewService";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogChip from "@/components/bog/BogChip/BogChip";
import BogModal from "@/components/bog/BogModal/BogModal";
import BogTable from "@/components/bog/BogTable/BogTable";

type Result = Awaited<ReturnType<typeof FormReviewService.listResponses>>;
export type ResponseListData = Omit<Result, "rows"> & {
  rows: (Omit<Result["rows"][number], "submittedAt" | "updatedAt"> & {
    submittedAt: string;
    updatedAt: string | null;
  })[];
};
type Preview = Awaited<
  ReturnType<typeof FormReviewService.previewStatusChange>
>;
const PAGE_SIZE = 25;
const inputClass =
  "rounded border border-grey-stroke-weak bg-white p-2 text-grey-text-strong";

async function checkResponse(response: Response) {
  if (response.ok) return;
  const body = await response.json().catch(() => null);
  throw new Error(
    typeof body?.error === "string"
      ? body.error
      : "Unable to complete the request. Please try again.",
  );
}

function date(iso: string | null) {
  return iso ? (
    <time dateTime={iso}>{iso.replace("T", " ").slice(0, 16)} UTC</time>
  ) : (
    "—"
  );
}

export default function FormResponsesClient({
  formId,
  title,
  initialData,
}: {
  formId: string;
  title: string;
  initialData: ResponseListData;
}) {
  const hydrated = useHydrated();
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState({
    status: "" as "" | SubmissionReviewStatus,
    search: "",
    page: 1,
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState(SubmissionReviewStatus.UnderReview);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dialogError, setDialogError] = useState("");
  const generation = useRef(0);
  const previewGeneration = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const busy =
    !hydrated || loading || working || open || search.trim() !== query.search;

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const response = await api.formResponses[":formId"].$get({
        param: { formId },
        query: {
          status: query.status || undefined,
          search: query.search,
          limit: String(PAGE_SIZE),
          offset: String((query.page - 1) * PAGE_SIZE),
        },
      });
      await checkResponse(response);
      const result = await response.json();
      if (request !== generation.current) return;
      const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
      if (query.page > lastPage) {
        setQuery((current) => ({ ...current, page: lastPage }));
        return;
      }
      setData(result);
    } catch (error) {
      if (request === generation.current)
        setError(
          error instanceof Error ? error.message : "Unable to load responses.",
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [formId, query]);

  useEffect(() => {
    void refresh();
    return invalidate;
  }, [refresh, invalidate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((current) =>
        current.search === search.trim()
          ? current
          : { ...current, search: search.trim(), page: 1 },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function changeQuery(next: Partial<typeof query>) {
    generation.current++;
    setLoading(true);
    setSelected(new Set());
    setQuery((current) => ({ ...current, ...next }));
  }

  async function loadPreview() {
    const request = ++previewGeneration.current;
    setPreview(null);
    setDialogError("");
    try {
      const response = await api.formResponses.status.preview.$post({
        json: { submissionIds: [...selected], status: target },
      });
      await checkResponse(response);
      const result = await response.json();
      if (request === previewGeneration.current) setPreview(result);
    } catch (error) {
      if (request === previewGeneration.current)
        setDialogError(
          error instanceof Error ? error.message : "Unable to preview changes.",
        );
    }
  }

  async function save() {
    setWorking(true);
    setDialogError("");
    try {
      const response = await api.formResponses.status.$patch({
        json: { submissionIds: [...selected], status: target },
      });
      await checkResponse(response);
      const changes = await response.json();
      setNotice(
        `${changes.filter((change) => change.changed).length} responses updated.`,
      );
      setSelected(new Set());
      setOpen(false);
      await refresh();
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "Unable to update responses.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function download() {
    setExporting(true);
    setError("");
    try {
      const response = await api.forms[":formId"]["export.csv"].$get({
        param: { formId },
      });
      await checkResponse(response);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${formId}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to export responses.",
      );
    } finally {
      setExporting(false);
    }
  }

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const allSelected =
    data.rows.length > 0 && data.rows.every((row) => selected.has(row.id));
  const someSelected = data.rows.some((row) => selected.has(row.id));

  return (
    <section
      aria-label="Form responses"
      className="mx-auto w-full space-y-6 px-4 py-8 text-grey-text-strong md:px-8"
    >
      <Link href="/settings/forms" className="text-brand-text underline">
        Back to forms
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-heading-2">{title}: Responses</h1>
        <BogButton
          variant="secondary"
          disabled={!hydrated || exporting}
          onClick={() => {
            void download();
          }}
        >
          Export CSV
        </BogButton>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          Search name or email
          <input
            type="search"
            maxLength={200}
            className={inputClass}
            value={search}
            disabled={!hydrated || working || open}
            onChange={(event) => {
              setSelected(new Set());
              setSearch(event.target.value);
            }}
          />
        </label>
        <div className="flex flex-col gap-1">
          <label htmlFor="response-status-filter">Review status</label>
          <select
            id="response-status-filter"
            className={inputClass}
            value={query.status}
            disabled={!hydrated || working || open}
            onChange={(event) =>
              changeQuery({
                status: event.target.value as typeof query.status,
                page: 1,
              })
            }
          >
            <option value="">
              All (
              {Object.values(data.counts).reduce(
                (sum, value) => sum + value,
                0,
              )}
              )
            </option>
            {Object.values(SubmissionReviewStatus).map((status) => (
              <option key={status} value={status}>
                {REVIEW_STATUS_LABELS[status]} ({data.counts[status]})
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <div role="alert" className="space-y-2">
          <p>{error}</p>
          <BogButton
            variant="secondary"
            onClick={() => {
              void refresh();
            }}
          >
            Retry loading responses
          </BogButton>
        </div>
      )}
      <p role="status" aria-live="polite">
        {loading ? "Loading responses…" : notice}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={busy || !data.rows.length || Boolean(error)}
            checked={allSelected}
            ref={(input) => {
              if (input) input.indeterminate = someSelected && !allSelected;
            }}
            onChange={() =>
              setSelected(
                allSelected
                  ? new Set()
                  : new Set(data.rows.map((row) => row.id)),
              )
            }
          />
          Select all on this page
        </label>
        <span>{selected.size} selected</span>
        <div className="flex items-center gap-2">
          <label htmlFor="response-bulk-status">Change selected to</label>
          <select
            id="response-bulk-status"
            className={inputClass}
            value={target}
            disabled={busy}
            onChange={(event) =>
              setTarget(event.target.value as SubmissionReviewStatus)
            }
          >
            {Object.values(SubmissionReviewStatus).map((status) => (
              <option key={status} value={status}>
                {REVIEW_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <BogModal
          openState={{
            open,
            setOpen: (next) => {
              if (!working) {
                if (next === false) previewGeneration.current++;
                setOpen(next);
              }
            },
          }}
          trigger={
            <BogButton
              disabled={busy || !selected.size || Boolean(error)}
              onClick={() => {
                void loadPreview();
              }}
            >
              Change status
            </BogButton>
          }
          title={<h2>Change review status?</h2>}
          description={
            <div className="space-y-3">
              <p>
                Set {selected.size} selected responses to{" "}
                {REVIEW_STATUS_LABELS[target]}?
              </p>
              {preview ? (
                <p>
                  Expected: {preview.notified} students will be notified;{" "}
                  {preview.memberTypesChanged} members will have their member
                  type changed. {preview.changed} responses will change.
                </p>
              ) : (
                !dialogError && <p role="status">Checking changes…</p>
              )}
              <p>
                Member type changes are not reversed by later status changes.
                Counts are rechecked when you confirm.
              </p>
              {dialogError && (
                <div role="alert">
                  <p>{dialogError}</p>
                  {!preview && (
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        void loadPreview();
                      }}
                    >
                      Retry preview
                    </button>
                  )}
                </div>
              )}
            </div>
          }
          primaryLabel={working ? "Saving…" : "Confirm status change"}
          secondaryLabel="Cancel"
          primaryDisabled={!preview || working}
          onPrimary={() => {
            void save();
          }}
          onSecondary={() => {
            if (!working) setOpen(false);
          }}
          contentProps={{
            onEscapeKeyDown: (event) => {
              if (working) event.preventDefault();
            },
            onInteractOutside: (event) => {
              if (working) event.preventDefault();
            },
          }}
        />
      </div>
      {!data.rows.length ? (
        <div className="rounded bg-grey-fill-weak p-8">
          <h2 className="text-heading-3">
            {query.search || query.status
              ? "No matching responses"
              : "No responses yet"}
          </h2>
          <p>
            {query.search || query.status
              ? "Try another search or review status."
              : "Responses will appear here when someone submits this form."}
          </p>
        </div>
      ) : (
        <div
          role="region"
          aria-label="Responses table; scroll horizontally to see all columns"
          tabIndex={0}
          aria-busy={loading}
          className="overflow-x-auto"
        >
          <BogTable
            columnHeaders={[
              "Submitter",
              "Email",
              "Submitted",
              "Last edited",
              "Review status",
              "Select",
              "Actions",
            ].map((content) => ({ content, datatype: "other" as const }))}
            rows={data.rows.map((row) => ({
              cells: [
                { content: row.name ?? "Guest or deleted account" },
                { content: row.email ?? "—" },
                { content: date(row.submittedAt) },
                { content: date(row.updatedAt) },
                {
                  content: (
                    <BogChip
                      color={REVIEW_STATUS_CHIP_COLORS[row.reviewStatus]}
                    >
                      {REVIEW_STATUS_LABELS[row.reviewStatus]}
                    </BogChip>
                  ),
                },
                {
                  content: (
                    <input
                      type="checkbox"
                      aria-label={`Select response from ${row.email ?? row.name ?? row.id}`}
                      checked={selected.has(row.id)}
                      disabled={busy || Boolean(error)}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          return next;
                        })
                      }
                    />
                  ),
                },
                {
                  content: (
                    <Link
                      className="text-brand-text underline"
                      href={`/settings/forms/${formId}/responses/${row.id}`}
                    >
                      View response
                    </Link>
                  ),
                },
              ],
            }))}
          />
        </div>
      )}
      <nav
        aria-label="Response pagination"
        className="flex flex-wrap items-center gap-4"
      >
        <BogButton
          variant="secondary"
          disabled={busy || query.page <= 1}
          onClick={() => changeQuery({ page: query.page - 1 })}
        >
          Previous
        </BogButton>
        <span>
          Page {query.page} of {pages} · {data.total} responses
        </span>
        <BogButton
          variant="secondary"
          disabled={busy || query.page >= pages}
          onClick={() => changeQuery({ page: query.page + 1 })}
        >
          Next
        </BogButton>
      </nav>
    </section>
  );
}
