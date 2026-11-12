"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Trash } from "@phosphor-icons/react";
import api from "@/core/api/client";
import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";
import type { MemberTypeRow } from "@/features/membership/services/MemberTypeService";
import BogModal from "@/components/bog/BogModal/BogModal";
import ThemedButton from "@/components/theme/ThemedButton";
import { cn } from "@/core/utils/utils";

type SerializableMemberTypeRow = MemberTypeRow;

const inputClass =
  "w-full rounded border border-grey-stroke-weak bg-page-bg p-2 text-grey-text-strong";

const actionClass =
  "rounded-control p-2 text-grey-icon-strong hover:bg-grey-fill-weak hover:text-page-text disabled:cursor-not-allowed disabled:text-grey-off-state disabled:hover:bg-transparent";

const readError = async (response: Response) => {
  const body = await response.json().catch(() => null);
  if (typeof body?.error === "string") return body.error;
  return "Unable to complete the request. Please try again.";
};

const sortTypes = (rows: SerializableMemberTypeRow[]) =>
  [...rows].sort(
    (a, b) => a.position - b.position || a.key.localeCompare(b.key),
  );

function AddTypeModal({
  disabled,
  onCreated,
}: {
  disabled: boolean;
  onCreated: (row: SerializableMemberTypeRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [pluralLabel, setPluralLabel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setLabel("");
    setPluralLabel("");
    setError("");
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saving) return;
    const trimmedLabel = label.trim();
    const trimmedPlural = pluralLabel.trim();
    if (!trimmedLabel || !trimmedPlural) {
      setError("Enter a label and a plural label");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await api.memberTypes.$post({
        json: { label: trimmedLabel, pluralLabel: trimmedPlural },
      });
      if (!response.ok) throw new Error(await readError(response));
      onCreated(await response.json());
      setOpen(false);
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BogModal
      openState={{ open, setOpen }}
      onOpenChange={(value) => {
        if (value) reset();
      }}
      trigger={
        <ThemedButton disabled={disabled} variant="primary">
          Add member type
        </ThemedButton>
      }
      title={<h2>Add member type</h2>}
      description={
        <form
          id="add-member-type-form"
          className="space-y-4"
          onSubmit={(event) => {
            void save(event);
          }}
          aria-busy={saving}
        >
          <label className="block" htmlFor="add-member-type-label">
            Label
            <input
              id="add-member-type-label"
              className={inputClass}
              value={label}
              disabled={saving}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label className="block" htmlFor="add-member-type-plural">
            Plural label
            <input
              id="add-member-type-plural"
              className={inputClass}
              value={pluralLabel}
              disabled={saving}
              onChange={(event) => setPluralLabel(event.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
        </form>
      }
      primaryLabel="Add"
      secondaryLabel="Cancel"
      primaryDisabled={saving || disabled}
      onPrimary={() => {
        void save();
      }}
    />
  );
}

function DeleteTypeModal({
  type,
  disabled,
  onDeleted,
}: {
  type: SerializableMemberTypeRow;
  disabled: boolean;
  onDeleted: (key: MemberTypeKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      const response = await api.memberTypes[":key"].$delete({
        param: { key: type.key },
      });
      if (!response.ok) throw new Error(await readError(response));
      onDeleted(type.key);
      setOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to delete type",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BogModal
      openState={{ open, setOpen }}
      onOpenChange={(value) => {
        if (!value) setError("");
      }}
      trigger={
        <button
          type="button"
          className={actionClass}
          aria-label={`Delete member type ${type.label}`}
          title="Delete"
          disabled={disabled}
        >
          <Trash size={18} aria-hidden />
        </button>
      }
      title={<h2>Delete member type?</h2>}
      description={
        <div className="space-y-2">
          <p>Delete “{type.label}”? This cannot be undone.</p>
          {error && <p role="alert">{error}</p>}
        </div>
      }
      primaryLabel="Delete"
      secondaryLabel="Cancel"
      primaryDisabled={disabled || deleting}
      onPrimary={() => {
        void handleDelete();
      }}
    />
  );
}

function TypeRow({
  type,
  index,
  count,
  busy,
  onRename,
  onMove,
  onDefault,
  onDeleted,
}: {
  type: SerializableMemberTypeRow;
  index: number;
  count: number;
  busy: boolean;
  onRename: (
    key: MemberTypeKey,
    label: string,
    pluralLabel: string,
  ) => Promise<void>;
  onMove: (index: number, offset: -1 | 1) => Promise<void>;
  onDefault: (key: MemberTypeKey | null) => Promise<void>;
  onDeleted: (key: MemberTypeKey) => void;
}) {
  const [label, setLabel] = useState(type.label);
  const [pluralLabel, setPluralLabel] = useState(type.pluralLabel);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const lastSaved = useRef({
    label: type.label,
    pluralLabel: type.pluralLabel,
  });

  useEffect(() => {
    setLabel(type.label);
    setPluralLabel(type.pluralLabel);
    lastSaved.current = { label: type.label, pluralLabel: type.pluralLabel };
  }, [type.label, type.pluralLabel, type.key]);

  const commitRename = async () => {
    const trimmedLabel = label.trim();
    const trimmedPlural = pluralLabel.trim();
    if (
      trimmedLabel === lastSaved.current.label &&
      trimmedPlural === lastSaved.current.pluralLabel
    ) {
      return;
    }
    if (!trimmedLabel || !trimmedPlural) {
      setFieldError("Label and plural label are required");
      setLabel(lastSaved.current.label);
      setPluralLabel(lastSaved.current.pluralLabel);
      return;
    }
    setSaving(true);
    setFieldError("");
    try {
      await onRename(type.key, trimmedLabel, trimmedPlural);
      lastSaved.current = {
        label: trimmedLabel,
        pluralLabel: trimmedPlural,
      };
    } catch (caught) {
      setFieldError(
        caught instanceof Error ? caught.message : "Unable to save labels",
      );
      setLabel(lastSaved.current.label);
      setPluralLabel(lastSaved.current.pluralLabel);
    } finally {
      setSaving(false);
    }
  };

  const rowDisabled = busy || saving;

  return (
    <li className="flex flex-col gap-4 rounded-control border border-grey-stroke-weak bg-page-bg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div
          className="min-w-0 flex-1 space-y-3"
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) {
              return;
            }
            void commitRename();
          }}
        >
          <label
            className="block text-grey-text-strong"
            htmlFor={`type-${type.key}-label`}
          >
            Label
            <input
              id={`type-${type.key}-label`}
              className={inputClass}
              value={label}
              disabled={rowDisabled}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label
            className="block text-grey-text-strong"
            htmlFor={`type-${type.key}-plural`}
          >
            Plural label
            <input
              id={`type-${type.key}-plural`}
              className={inputClass}
              value={pluralLabel}
              disabled={rowDisabled}
              onChange={(event) => setPluralLabel(event.target.value)}
            />
          </label>
          <p className="text-paragraph-2 text-grey-text-weak">
            Key: {type.key}
          </p>
          {fieldError && <p role="alert">{fieldError}</p>}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className={actionClass}
            aria-label={`Move member type ${index + 1} up`}
            title="Move up"
            disabled={rowDisabled || index === 0}
            onClick={() => {
              void onMove(index, -1);
            }}
          >
            <ArrowUp size={18} aria-hidden />
          </button>
          <button
            type="button"
            className={actionClass}
            aria-label={`Move member type ${index + 1} down`}
            title="Move down"
            disabled={rowDisabled || index === count - 1}
            onClick={() => {
              void onMove(index, 1);
            }}
          >
            <ArrowDown size={18} aria-hidden />
          </button>
          <DeleteTypeModal
            type={type}
            disabled={rowDisabled}
            onDeleted={onDeleted}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-grey-text-strong">
        <input
          type="radio"
          name="signup-default"
          checked={type.isSignupDefault}
          disabled={rowDisabled}
          aria-label={`Signup default for ${type.label}`}
          onChange={() => {
            if (!type.isSignupDefault) void onDefault(type.key);
          }}
        />
        Signup default
      </label>
    </li>
  );
}

export default function MemberTypesClient({
  initialTypes,
}: {
  initialTypes: SerializableMemberTypeRow[];
}) {
  const [types, setTypes] = useState(() => sortTypes(initialTypes));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTypes(sortTypes(initialTypes));
  }, [initialTypes]);

  const withPositions = (rows: SerializableMemberTypeRow[]) =>
    rows.map((row, position) => ({ ...row, position }));

  const handleRename = async (
    key: MemberTypeKey,
    label: string,
    pluralLabel: string,
  ) => {
    const response = await api.memberTypes[":key"].$patch({
      param: { key },
      json: { label, pluralLabel },
    });
    if (!response.ok) throw new Error(await readError(response));
    const updated = await response.json();
    setTypes((current) =>
      sortTypes(
        current.map((row) => (row.key === key ? { ...row, ...updated } : row)),
      ),
    );
  };

  const handleMove = async (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= types.length) return;
    const previous = types;
    const reordered = [...types];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    const keys = reordered.map((row) => row.key);
    setTypes(withPositions(reordered));
    setError("");
    setBusy(true);
    try {
      const response = await api.memberTypes.order.$put({ json: keys });
      if (!response.ok) throw new Error(await readError(response));
      setTypes(sortTypes(await response.json()));
    } catch (caught) {
      setTypes(previous);
      setError(
        caught instanceof Error ? caught.message : "Unable to reorder types",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDefault = async (key: MemberTypeKey | null) => {
    const previous = types;
    setTypes(
      withPositions(
        types.map((row) => ({
          ...row,
          isSignupDefault: key !== null && row.key === key,
        })),
      ),
    );
    setError("");
    setBusy(true);
    try {
      const response = await api.memberTypes.signupDefault.$put({
        json: { key },
      });
      if (!response.ok) throw new Error(await readError(response));
    } catch (caught) {
      setTypes(previous);
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to set signup default",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreated = (row: SerializableMemberTypeRow) => {
    setTypes((current) => sortTypes([...current, row]));
    setError("");
  };

  const handleDeleted = (key: MemberTypeKey) => {
    setTypes((current) => current.filter((row) => row.key !== key));
    setError("");
  };

  return (
    <div className="space-y-6 p-8" aria-busy={busy}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-2 text-brand-text">Member types</h1>
          <p className="text-grey-text-weak">
            Add, rename, and reorder the types members can have.
          </p>
        </div>
        <AddTypeModal disabled={busy} onCreated={handleCreated} />
      </header>
      {error && <p role="alert">{error}</p>}
      {!types.length ? (
        <div className={cn("rounded bg-grey-fill-weak p-8")}>
          <h2 className="text-heading-3">No member types yet</h2>
          <p>Add a type to use it for signups and member filters.</p>
        </div>
      ) : (
        <>
          <fieldset className="rounded-control border border-grey-stroke-weak p-4">
            <legend className="px-1 text-grey-text-strong">
              Signup default
            </legend>
            <label className="flex items-center gap-2 text-grey-text-strong">
              <input
                type="radio"
                name="signup-default"
                checked={!types.some((row) => row.isSignupDefault)}
                disabled={busy}
                onChange={() => {
                  void handleDefault(null);
                }}
              />
              None
            </label>
          </fieldset>
          <ul className="space-y-4" role="list" aria-label="Member types">
            {types.map((type, index) => (
              <TypeRow
                key={type.key}
                type={type}
                index={index}
                count={types.length}
                busy={busy}
                onRename={handleRename}
                onMove={handleMove}
                onDefault={handleDefault}
                onDeleted={handleDeleted}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
