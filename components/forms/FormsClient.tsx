"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { FormStatus, MemberType } from "@/lib/schema";
import {
  FormIdSchema,
  FormSettingsSchema,
  getAcceptedMemberType,
  getAssignedMemberTypes,
  getDueAt,
  type FormSettings,
} from "@/lib/forms/schema";
import { suggestFormId } from "@/lib/forms/management";
import {
  MEMBER_TYPE_LABELS,
  MEMBER_TYPE_PLURAL_LABELS,
} from "@/lib/memberTypes";
import type { FormService } from "@/lib/services/FormService";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogTable from "@/components/bog/BogTable/BogTable";
import BogChip from "@/components/bog/BogChip/BogChip";
import BogModal from "@/components/bog/BogModal/BogModal";

type FormRow = Omit<
  Awaited<ReturnType<typeof FormService.list>>[number],
  "createdAt" | "updatedAt"
> & { createdAt: string; updatedAt: string };
const inputClass =
  "w-full rounded border border-grey-stroke-weak bg-white p-2 text-grey-text-strong";

async function checkResponse(response: Response) {
  if (response.ok) return;
  const body = await response.json().catch(() => null);
  const issues = body?.error?.issues ?? body?.issues;
  throw new Error(
    typeof body?.error === "string"
      ? body.error
      : issues?.map((issue: { message: string }) => issue.message).join("; ") ||
          "Unable to save changes. Please try again.",
  );
}

function localDate(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function FormDialog({
  form,
  onSaved,
  disabled,
  memberTypesEnabled,
}: {
  form?: FormRow;
  onSaved: () => Promise<void>;
  disabled: boolean;
  memberTypesEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(form?.title ?? "");
  const [formId, setFormId] = useState(form?.formId ?? "");
  const [editedId, setEditedId] = useState(false);
  const [description, setDescription] = useState(form?.description ?? "");
  const [settings, setSettings] = useState<FormSettings | undefined>(
    form?.settings,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const idResult = FormIdSchema.safeParse(formId);
  const prefix = form ? `settings-${form.id}` : "create-form";
  const canRename = !form || form.status === FormStatus.Draft;

  function changeSetting<K extends keyof FormSettings>(
    key: K,
    value: FormSettings[K],
  ) {
    setSettings((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    if (!title.trim() || !idResult.success) {
      setError("Enter a title and a valid form ID");
      return;
    }
    if (settings) {
      const result = FormSettingsSchema.safeParse(settings);
      if (!result.success) {
        setError(result.error.issues.map((issue) => issue.message).join("; "));
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const response = form
        ? await api.forms[":formId"].$patch({
            param: { formId: form.formId },
            json: { title, formId, description: description || null, settings },
          })
        : await api.forms.$post({ json: { title, formId } });
      await checkResponse(response);
      await onSaved();
      setOpen(false);
      if (!form) {
        setTitle("");
        setFormId("");
        setEditedId(false);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save form");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BogModal
      openState={{ open, setOpen }}
      onOpenChange={(value) => {
        if (value) {
          setTitle(form?.title ?? "");
          setFormId(form?.formId ?? "");
          setDescription(form?.description ?? "");
          setSettings(form?.settings);
          setEditedId(false);
          setError("");
        }
      }}
      trigger={
        <BogButton disabled={disabled} variant={form ? "secondary" : "primary"}>
          {form ? "Settings" : "Create Form"}
        </BogButton>
      }
      title={<h2>{form ? "Form settings" : "Create Form"}</h2>}
      description={
        <div className="max-h-96 overflow-y-auto">
          <form
            id={`${prefix}-form`}
            ref={formRef}
            onSubmit={save}
            className="space-y-4 p-1"
            aria-busy={saving}
          >
            <fieldset disabled={saving} className="space-y-4">
              <label className="block" htmlFor={`${prefix}-title`}>
                Title
                <input
                  id={`${prefix}-title`}
                  className={inputClass}
                  required
                  value={title}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTitle(value);
                    if (!form && !editedId) setFormId(suggestFormId(value));
                  }}
                />
              </label>
              <label className="block" htmlFor={`${prefix}-id`}>
                Form ID
                <input
                  id={`${prefix}-id`}
                  className={inputClass}
                  required
                  maxLength={64}
                  disabled={!canRename}
                  value={formId}
                  aria-invalid={formId.length > 0 && !idResult.success}
                  aria-describedby={`${prefix}-id-help`}
                  onChange={(event) => {
                    setFormId(event.target.value);
                    setEditedId(true);
                  }}
                />
              </label>
              <p id={`${prefix}-id-help`} className="text-sm">
                {!canRename
                  ? "Form IDs can only change while draft."
                  : formId && !idResult.success
                    ? idResult.error.issues[0].message
                    : "Lowercase letters, numbers, and hyphens; up to 64 characters."}
              </p>
              {settings && (
                <>
                  <label className="block">
                    Description
                    <textarea
                      className={inputClass}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </label>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={settings.requireLogin}
                      onChange={(event) =>
                        changeSetting("requireLogin", event.target.checked)
                      }
                    />
                    Require login
                  </label>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={settings.allowMultipleSubmissions}
                      onChange={(event) =>
                        changeSetting(
                          "allowMultipleSubmissions",
                          event.target.checked,
                        )
                      }
                    />
                    Allow multiple submissions per user
                  </label>
                  <p className="text-sm">Dates use your local time zone.</p>
                  <label className="block">
                    Opens at
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={localDate(settings.opensAt)}
                      onChange={(event) =>
                        changeSetting(
                          "opensAt",
                          event.target.value
                            ? new Date(event.target.value).toISOString()
                            : null,
                        )
                      }
                    />
                  </label>
                  <label className="block">
                    Closes at
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={localDate(settings.closesAt)}
                      onChange={(event) =>
                        changeSetting(
                          "closesAt",
                          event.target.value
                            ? new Date(event.target.value).toISOString()
                            : null,
                        )
                      }
                    />
                  </label>
                  <label className="block">
                    Due date
                    <input
                      type="datetime-local"
                      className={inputClass}
                      value={localDate(getDueAt(settings))}
                      aria-describedby={`${prefix}-due-help`}
                      onChange={(event) =>
                        changeSetting(
                          "dueAt",
                          event.target.value
                            ? new Date(event.target.value).toISOString()
                            : null,
                        )
                      }
                    />
                  </label>
                  <p id={`${prefix}-due-help`} className="text-sm">
                    Shown on dashboards. The form stays open until it closes.
                  </p>
                  {memberTypesEnabled && (
                    <>
                      <fieldset className="space-y-2">
                        <legend>Required for</legend>
                        {Object.values(MemberType).map((type) => (
                          <label key={type} className="flex gap-2">
                            <input
                              type="checkbox"
                              checked={getAssignedMemberTypes(
                                settings,
                              ).includes(type)}
                              onChange={(event) => {
                                const others = getAssignedMemberTypes(
                                  settings,
                                ).filter((assigned) => assigned !== type);
                                changeSetting(
                                  "assignedMemberTypes",
                                  event.target.checked
                                    ? [...others, type]
                                    : others,
                                );
                              }}
                            />
                            {MEMBER_TYPE_PLURAL_LABELS[type]}
                          </label>
                        ))}
                      </fieldset>
                      <label className="block">
                        When a response is accepted, make the member
                        <select
                          className={inputClass}
                          value={getAcceptedMemberType(settings) ?? ""}
                          onChange={(event) =>
                            changeSetting(
                              "acceptedMemberType",
                              (event.target.value as MemberType) || null,
                            )
                          }
                        >
                          <option value="">No change</option>
                          {Object.values(MemberType).map((type) => (
                            <option key={type} value={type}>
                              {MEMBER_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  <label className="block">
                    Confirmation message
                    <textarea
                      required
                      className={inputClass}
                      value={settings.confirmationMessage}
                      onChange={(event) =>
                        changeSetting("confirmationMessage", event.target.value)
                      }
                    />
                  </label>
                </>
              )}
            </fieldset>
            {error && <p role="alert">{error}</p>}
            <button type="submit" className="sr-only" tabIndex={-1}>
              Save form
            </button>
          </form>
        </div>
      }
      primaryLabel={saving ? "Saving…" : form ? "Save settings" : "Create"}
      secondaryLabel="Cancel"
      primaryDisabled={saving || !title.trim() || !idResult.success}
      onPrimary={() => {
        formRef.current?.requestSubmit();
      }}
    />
  );
}

function DeleteDialog({
  form,
  disabled,
  onDelete,
}: {
  form: FormRow;
  disabled: boolean;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  async function handleDelete() {
    setError("");
    try {
      await onDelete();
      setOpen(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to delete form",
      );
    }
  }
  return (
    <BogModal
      openState={{ open, setOpen }}
      trigger={
        <BogButton variant="secondary" disabled={disabled}>
          Delete
        </BogButton>
      }
      title={<h2>Delete form?</h2>}
      description={
        <div>
          <p>Delete “{form.title}”? This cannot be undone.</p>
          {error && <p role="alert">{error}</p>}
        </div>
      }
      primaryLabel="Delete form"
      secondaryLabel="Cancel"
      primaryDisabled={disabled}
      onPrimary={() => {
        void handleDelete();
      }}
    />
  );
}

export default function FormsClient({
  forms,
  memberTypesEnabled = false,
}: {
  forms: FormRow[];
  /** Shows the member type settings (#302's MemberTypesEnabled). */
  memberTypesEnabled?: boolean;
}) {
  const hydrated = useHydrated();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedForms, setRefreshedForms] = useState<{
    source: FormRow[];
    rows: FormRow[];
  } | null>(null);
  // A new server snapshot (including an organization switch) supersedes local data.
  const rows = refreshedForms?.source === forms ? refreshedForms.rows : forms;
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = !hydrated || refreshing || working;
  async function refresh() {
    setRefreshing(true);
    try {
      const response = await api.forms.$get();
      await checkResponse(response);
      setRefreshedForms({ source: forms, rows: await response.json() });
    } finally {
      setRefreshing(false);
    }
  }

  async function run(action: () => Promise<void>) {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to complete action",
      );
      throw error;
    } finally {
      setWorking(false);
    }
  }

  function changeStatus(form: FormRow) {
    void run(async () => {
      const route = api.forms[":formId"];
      const args = { param: { formId: form.formId } };
      const response =
        form.status === FormStatus.Draft
          ? await route.publish.$post(args)
          : form.status === FormStatus.Published
            ? await route.close.$post(args)
            : await route.reopen.$post(args);
      await checkResponse(response);
      await refresh();
    }).catch(() => {});
  }

  async function download(form: FormRow) {
    await run(async () => {
      const response = await api.forms[":formId"]["export.csv"].$get({
        param: { formId: form.formId },
      });
      await checkResponse(response);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${form.formId}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("CSV exported.");
    });
  }

  return (
    <section
      aria-label="Forms management"
      className="mx-auto w-full space-y-6 px-4 py-8 text-grey-text-strong md:px-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-heading-2">Forms</h1>
        <FormDialog
          onSaved={refresh}
          disabled={busy}
          memberTypesEnabled={memberTypesEnabled}
        />
      </div>
      <p>Create forms, manage publication, and export responses.</p>
      {error && <p role="alert">{error}</p>}
      <p role="status" aria-live="polite">
        {busy ? "Updating forms…" : notice}
      </p>
      {!rows.length ? (
        <div className="rounded bg-grey-fill-weak p-8">
          <h2 className="text-heading-3">No forms yet</h2>
          <p>Create your first form to get started.</p>
        </div>
      ) : (
        <div
          className="overflow-x-auto"
          aria-busy={busy}
          tabIndex={0}
          role="region"
          aria-label="Forms table; scroll horizontally to see all columns"
        >
          <BogTable
            columnHeaders={[
              { content: "Title", datatype: "string" },
              { content: "Form ID", datatype: "string" },
              { content: "Status", datatype: "string" },
              { content: "Questions", datatype: "number" },
              { content: "Responses", datatype: "number" },
              { content: "Last updated", datatype: "string" },
              { content: "Actions", datatype: "other" },
            ]}
            rows={rows.map((form) => ({
              cells: [
                { content: form.title },
                { content: form.formId },
                {
                  content: (
                    <BogChip
                      color={
                        form.status === FormStatus.Published
                          ? "green"
                          : form.status === FormStatus.Closed
                            ? "gray"
                            : "orange"
                      }
                    >
                      {form.status}
                    </BogChip>
                  ),
                },
                { content: form.questionCount },
                { content: form.responseCount },
                {
                  content: (
                    <time dateTime={form.updatedAt}>
                      {form.updatedAt.replace("T", " ").slice(0, 16)} UTC
                    </time>
                  ),
                },
                {
                  content: (
                    <div
                      className="flex flex-wrap gap-2"
                      aria-label={`Actions for ${form.title}`}
                    >
                      {form.status === FormStatus.Draft && (
                        <Link
                          className="self-center underline"
                          href={`/settings/forms/${form.formId}`}
                        >
                          Edit questions
                        </Link>
                      )}
                      <FormDialog
                        key={`${form.formId}-${form.updatedAt}`}
                        form={form}
                        onSaved={refresh}
                        disabled={busy}
                        memberTypesEnabled={memberTypesEnabled}
                      />
                      <BogButton
                        variant="secondary"
                        disabled={busy}
                        onClick={() => changeStatus(form)}
                      >
                        {form.status === FormStatus.Draft
                          ? "Publish"
                          : form.status === FormStatus.Published
                            ? "Close"
                            : "Reopen"}
                      </BogButton>
                      {form.status === FormStatus.Draft && (
                        <DeleteDialog
                          form={form}
                          disabled={busy || form.responseCount > 0}
                          onDelete={async () => {
                            await run(async () => {
                              await checkResponse(
                                await api.forms[":formId"].$delete({
                                  param: { formId: form.formId },
                                }),
                              );
                              await refresh();
                            });
                          }}
                        />
                      )}
                      <BogButton
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          void run(async () => {
                            await navigator.clipboard.writeText(
                              new URL(
                                `/forms/${form.formId}`,
                                window.location.origin,
                              ).href,
                            );
                            setNotice("Form link copied.");
                          }).catch(() => {});
                        }}
                      >
                        Copy link
                      </BogButton>
                      <BogButton
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          void download(form).catch(() => {});
                        }}
                      >
                        Export CSV
                      </BogButton>
                    </div>
                  ),
                },
              ],
            }))}
          />
        </div>
      )}
    </section>
  );
}
