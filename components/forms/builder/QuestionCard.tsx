"use client";

import type { ComponentType } from "react";
import { ArrowDown, ArrowUp, Copy, Trash } from "@phosphor-icons/react";
import {
  questionFieldId,
  type DraftQuestion,
  type QuestionErrors,
} from "@/components/forms/builder/draft";
import {
  builderInputClass,
  FieldError,
  fieldProps,
  inputBorder,
} from "@/components/forms/builder/fields";
import {
  QUESTION_TYPES,
  type SettingsProps,
} from "@/components/forms/builder/questionTypes";
import { FormComponentType } from "@/lib/schema";
import { cn } from "@/lib/utils";

type QuestionCardProps = {
  question: DraftQuestion;
  index: number;
  count: number;
  errors: QuestionErrors;
  readOnly: boolean;
  onChange: (question: DraftQuestion) => void;
  onMove: (offset: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

const actionClass =
  "rounded-control p-2 text-grey-icon-strong hover:bg-grey-fill-weak hover:text-page-text disabled:cursor-not-allowed disabled:text-grey-off-state disabled:hover:bg-transparent";

/** One question's label, help text, required flag, and settings. */
export default function QuestionCard({
  question,
  index,
  count,
  errors,
  readOnly,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: QuestionCardProps) {
  const { key, type } = question;
  const definition = QUESTION_TYPES[type];
  const isHeader = type === FormComponentType.SectionHeader;
  const headingId = questionFieldId(key, "heading");
  const label = fieldProps(key, "label", errors);
  const helpTextId = questionFieldId(key, "helpText");
  // The registry is typed per type; this question's config matches its type.
  const Settings = definition.Settings as ComponentType<
    SettingsProps<typeof type>
  > | null;
  const title = question.label.trim() || "Untitled";

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-control border border-grey-stroke-weak bg-page-bg p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3
          id={headingId}
          tabIndex={-1}
          className="text-paragraph-1 font-semibold text-page-text focus:outline-none"
        >
          <span className="text-grey-text-weak">
            {index + 1}. {definition.name}
          </span>
          <span className="sr-only">: {title}</span>
        </h3>
        {!readOnly && (
          <div className="flex gap-1">
            <button
              type="button"
              className={actionClass}
              aria-label={`Move question ${index + 1} up`}
              title="Move up"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUp size={18} aria-hidden />
            </button>
            <button
              type="button"
              className={actionClass}
              aria-label={`Move question ${index + 1} down`}
              title="Move down"
              disabled={index === count - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDown size={18} aria-hidden />
            </button>
            <button
              type="button"
              className={actionClass}
              aria-label={`Duplicate question ${index + 1}`}
              title="Duplicate"
              onClick={onDuplicate}
            >
              <Copy size={18} aria-hidden />
            </button>
            <button
              type="button"
              className={actionClass}
              aria-label={`Remove question ${index + 1}`}
              title="Remove"
              onClick={onRemove}
            >
              <Trash size={18} aria-hidden />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={label.id}
          className="text-paragraph-2 font-semibold text-page-text"
        >
          {isHeader ? "Title" : "Question"}
        </label>
        <input
          id={label.id}
          aria-invalid={label["aria-invalid"]}
          aria-describedby={label["aria-describedby"]}
          value={question.label}
          onChange={(event) =>
            onChange({ ...question, label: event.target.value })
          }
          className={cn(builderInputClass, inputBorder(label.error))}
        />
        <FieldError questionKey={key} path="label" error={label.error} />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={helpTextId}
          className="text-paragraph-2 font-semibold text-page-text"
        >
          {isHeader ? "Description" : "Help text"}{" "}
          <span className="font-normal text-grey-text-weak">(optional)</span>
        </label>
        <textarea
          id={helpTextId}
          rows={2}
          value={question.helpText}
          onChange={(event) =>
            onChange({ ...question, helpText: event.target.value })
          }
          className={cn(builderInputClass, inputBorder(undefined), "resize-y")}
        />
      </div>

      {!isHeader && (
        <label className="flex items-center gap-2 text-paragraph-2 text-page-text">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(event) =>
              onChange({ ...question, required: event.target.checked })
            }
            className="size-4 accent-brand-text"
          />
          Required
        </label>
      )}

      {Settings && (
        <div className="flex flex-col gap-3 border-t border-grey-stroke-weak pt-4">
          <Settings
            questionKey={key}
            config={question.config as never}
            errors={errors}
            onChange={(config) =>
              onChange({
                ...question,
                config: config as Record<string, unknown>,
              })
            }
          />
        </div>
      )}
      {/* Errors on the whole config, e.g. settings a type doesn't take. */}
      <FieldError questionKey={key} path="config" error={errors.config} />
    </section>
  );
}
