"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  questionErrorId,
  questionFieldId,
  type QuestionErrors,
} from "@/components/forms/builder/draft";
import { cn } from "@/lib/utils";

export const builderInputClass =
  "w-full rounded-control border bg-page-bg px-3 py-2 text-paragraph-2 text-page-text focus:border-brand-stroke-strong focus:outline-none disabled:cursor-not-allowed disabled:bg-grey-fill-weaker";

export function inputBorder(error: string | undefined) {
  return error
    ? "border-status-red-stroke-strong"
    : "border-grey-stroke-weak hover:border-brand-stroke-strong";
}

/** The props a field needs to show its error, from the question's errors. */
export function fieldProps(
  questionKey: string,
  path: string,
  errors: QuestionErrors,
) {
  const error = errors[path];
  return {
    id: questionFieldId(questionKey, path),
    error,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? questionErrorId(questionKey, path) : undefined,
  };
}

export function FieldError({
  questionKey,
  path,
  error,
}: {
  questionKey: string;
  path: string;
  error: string | undefined;
}) {
  if (!error) return null;
  return (
    <p
      id={questionErrorId(questionKey, path)}
      className="text-paragraph-2 text-status-red-text"
    >
      {error}
    </p>
  );
}

type SettingProps<V> = {
  questionKey: string;
  path: string;
  label: string;
  hint?: ReactNode;
  value: V | undefined;
  errors: QuestionErrors;
  onChange: (value: V | undefined) => void;
};

function parseNumber(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  // NaN fails validation, so a typo shows "Enter a number".
  return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed) ? Number(trimmed) : NaN;
}

/** A number setting that's blank when unset. */
export function NumberSetting({
  questionKey,
  path,
  label,
  hint,
  value,
  errors,
  onChange,
}: SettingProps<number>) {
  const { error, ...inputProps } = fieldProps(questionKey, path, errors);
  // Keep what was typed, like "1.", while the value stays the same number.
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    if (!Object.is(parseNumber(text), value))
      setText(value === undefined || Number.isNaN(value) ? "" : String(value));
    // Only resync when the value changes from outside, e.g. a discard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputProps.id}
        className="text-paragraph-2 font-semibold text-page-text"
      >
        {label}
      </label>
      <input
        {...inputProps}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseNumber(event.target.value));
        }}
        className={cn(builderInputClass, inputBorder(error), "max-w-40")}
      />
      {hint && <p className="text-paragraph-2 text-grey-text-weak">{hint}</p>}
      <FieldError questionKey={questionKey} path={path} error={error} />
    </div>
  );
}

/** A calendar date setting that's blank when unset. */
export function DateSetting({
  questionKey,
  path,
  label,
  value,
  errors,
  onChange,
}: SettingProps<string>) {
  const { error, ...inputProps } = fieldProps(questionKey, path, errors);
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputProps.id}
        className="text-paragraph-2 font-semibold text-page-text"
      >
        {label}
      </label>
      <input
        {...inputProps}
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        className={cn(builderInputClass, inputBorder(error), "max-w-48")}
      />
      <FieldError questionKey={questionKey} path={path} error={error} />
    </div>
  );
}

/** A yes/no setting, like "Whole numbers only". */
export function CheckboxSetting({
  questionKey,
  path,
  label,
  value,
  onChange,
}: Omit<SettingProps<boolean>, "errors">) {
  const id = questionFieldId(questionKey, path);
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 text-paragraph-2 text-page-text"
    >
      <input
        id={id}
        type="checkbox"
        checked={value ?? false}
        onChange={(event) => onChange(event.target.checked || undefined)}
        className="size-4 accent-brand-text"
      />
      {label}
    </label>
  );
}
