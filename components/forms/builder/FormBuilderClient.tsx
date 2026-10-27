"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react";
import BogChip from "@/components/bog/BogChip/BogChip";
import SaveBanner from "@/components/SaveBanner";
import {
  newKey,
  questionFieldId,
  snapshot,
  toDraft,
  toInput,
  validateQuestion,
  type DraftQuestion,
  type QuestionErrors,
} from "@/components/forms/builder/draft";
import QuestionCard from "@/components/forms/builder/QuestionCard";
import {
  QUESTION_TYPE_ORDER,
  QUESTION_TYPES,
} from "@/components/forms/builder/questionTypes";
import api from "@/lib/api";
import { FORM_QUESTIONS_MAX } from "@/lib/forms/management";
import type { FormComponent } from "@/lib/forms/schema";
import { FormComponentType, FormStatus } from "@/lib/schema";

type FormBuilderClientProps = {
  formId: string;
  title: string;
  status: FormStatus;
  questions: FormComponent[];
};

const STATUS_LABELS: Record<FormStatus, string> = {
  [FormStatus.Draft]: "Draft",
  [FormStatus.Published]: "Published",
  [FormStatus.Closed]: "Closed",
};

const UNSAVED_MESSAGE = "You have unsaved changes. Leave without saving?";

async function errorMessage(response: Response) {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error as string;
  } catch {
    // Not JSON; use the generic message.
  }
  return undefined;
}

/** Adds, edits, reorders, and removes a draft form's questions. */
export default function FormBuilderClient({
  formId,
  title,
  status,
  questions,
}: FormBuilderClientProps) {
  const readOnly = status !== FormStatus.Draft;
  // The last saved questions, which discarding goes back to.
  const [savedQuestions, setSavedQuestions] = useState(questions);
  const [drafts, setDrafts] = useState(() => questions.map(toDraft));
  const saved = useMemo(
    () => snapshot(savedQuestions.map(toDraft)),
    [savedQuestions],
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"success" | "error" | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string>();
  const [announcement, setAnnouncement] = useState("");
  const focusTarget = useRef<string | null>(null);

  const dirty = snapshot(drafts) !== saved;
  const errors = useMemo(
    () =>
      Object.fromEntries(
        drafts.map((draft) => [draft.key, validateQuestion(draft)]),
      ) as Record<string, QuestionErrors>,
    [drafts],
  );

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Moves focus once the change that needs it has rendered.
  useEffect(() => {
    if (!focusTarget.current) return;
    const element = document.getElementById(focusTarget.current);
    element?.focus();
    element?.scrollIntoView?.({ block: "center" });
    focusTarget.current = null;
  });

  function update(next: DraftQuestion[], message = "") {
    setDrafts(next);
    setSaveStatus(null);
    setAnnouncement(message);
  }

  function add(type: FormComponentType) {
    const draft: DraftQuestion = {
      key: newKey(),
      type,
      label: "",
      helpText: "",
      required: false,
      config: { ...QUESTION_TYPES[type].defaultConfig },
    };
    focusTarget.current = questionFieldId(draft.key, "label");
    update(
      [...drafts, draft],
      `Added a ${QUESTION_TYPES[type].name.toLowerCase()} question`,
    );
  }

  function move(index: number, offset: -1 | 1) {
    const next = [...drafts];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    update(
      next,
      `Moved question ${index + 1} to position ${index + offset + 1}`,
    );
  }

  function duplicate(index: number) {
    const copy: DraftQuestion = {
      ...structuredClone(drafts[index]),
      key: newKey(),
      id: undefined,
    };
    focusTarget.current = questionFieldId(copy.key, "label");
    update(
      [...drafts.slice(0, index + 1), copy, ...drafts.slice(index + 1)],
      `Duplicated question ${index + 1}`,
    );
  }

  function remove(index: number) {
    const next = drafts.filter((_, i) => i !== index);
    const neighbor = next[Math.min(index, next.length - 1)];
    focusTarget.current = neighbor
      ? questionFieldId(neighbor.key, "heading")
      : "add-question-heading";
    update(next, `Removed question ${index + 1}`);
  }

  function discard() {
    setDrafts(savedQuestions.map(toDraft));
    setShowErrors(false);
    setSaveStatus(null);
    setAnnouncement("Discarded unsaved changes");
  }

  async function save() {
    setShowErrors(true);
    const invalid = drafts.find(
      (draft) => Object.keys(errors[draft.key]).length > 0,
    );
    if (invalid) {
      const [path] = Object.keys(errors[invalid.key]);
      focusTarget.current =
        path === "config"
          ? questionFieldId(invalid.key, "heading")
          : questionFieldId(invalid.key, path);
      setSaveError("Fix the highlighted questions, then save again.");
      setSaveStatus("error");
      return;
    }

    setSaving(true);
    try {
      const response = await api.forms[":formId"].questions.$put({
        param: { formId },
        json: { questions: drafts.map(toInput) },
      });
      if (!response.ok) {
        setSaveError(await errorMessage(response));
        setSaveStatus("error");
        return;
      }
      const body = await response.json();
      const savedNow = body.questions as FormComponent[];
      // Keep each question's key so focus and scroll position stay put.
      setDrafts(
        savedNow.map((question, index) => ({
          ...toDraft(question),
          key: drafts[index]?.key ?? newKey(),
        })),
      );
      setSavedQuestions(savedNow);
      setShowErrors(false);
      setSaveError(undefined);
      setSaveStatus("success");
    } catch {
      setSaveError(undefined);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-label="Question builder"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 text-page-text md:px-8"
    >
      <Link
        href="/settings/forms"
        className="flex items-center gap-1 self-start text-paragraph-2 font-semibold text-brand-text hover:underline"
        onClick={(event) => {
          if (dirty && !window.confirm(UNSAVED_MESSAGE)) event.preventDefault();
        }}
      >
        <ArrowLeft size={16} aria-hidden />
        Back to forms
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-heading-2">Edit questions</h1>
          <p className="flex flex-wrap items-center gap-2 text-paragraph-1 text-grey-text-weak">
            {title}
            <BogChip
              color={
                status === FormStatus.Published
                  ? "green"
                  : status === FormStatus.Closed
                    ? "gray"
                    : "orange"
              }
            >
              {STATUS_LABELS[status]}
            </BogChip>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/forms/${formId}?preview=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-control border border-grey-stroke-weak px-3 py-2 text-paragraph-2 font-semibold text-page-text hover:border-brand-stroke-strong"
          >
            Preview
            <ArrowSquareOut size={16} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={discard}
                disabled={!dirty || saving}
                className="rounded-control px-3 py-2 text-paragraph-2 font-semibold text-brand-text hover:bg-brand-fill disabled:cursor-not-allowed disabled:text-grey-off-state disabled:hover:bg-transparent"
              >
                Discard changes
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="rounded-control bg-brand-text px-4 py-2 text-paragraph-2 font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:bg-grey-fill-weak disabled:text-grey-text-weak"
              >
                {saving ? "Saving…" : "Save questions"}
              </button>
            </>
          )}
        </div>
      </div>

      <SaveBanner status={saveStatus} errorMessage={saveError} />
      {readOnly ? (
        <p
          role="note"
          className="rounded-control border border-status-blue-stroke-weak bg-status-blue-fill p-4 text-paragraph-2 text-page-text"
        >
          Questions lock once a form is published, so this{" "}
          {STATUS_LABELS[status].toLowerCase()} form&apos;s questions are
          read-only.
        </p>
      ) : (
        dirty && (
          <p className="text-paragraph-2 text-status-amber-text">
            You have unsaved changes. Preview shows the last saved version.
          </p>
        )
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section aria-labelledby="questions-heading" className="min-w-0">
          <h2 id="questions-heading" className="sr-only">
            Questions
          </h2>
          {drafts.length === 0 ? (
            <p className="rounded-control border border-dashed border-grey-stroke-strong p-8 text-center text-paragraph-2 text-grey-text-weak">
              {readOnly
                ? "This form has no questions."
                : "No questions yet. Add one from the list."}
            </p>
          ) : (
            // A disabled fieldset makes every control read-only at once.
            <fieldset disabled={readOnly} className="min-w-0">
              <ol className="flex flex-col gap-4">
                {drafts.map((draft, index) => (
                  <li key={draft.key}>
                    <QuestionCard
                      question={draft}
                      index={index}
                      count={drafts.length}
                      errors={showErrors ? errors[draft.key] : {}}
                      readOnly={readOnly}
                      onChange={(question) =>
                        update(
                          drafts.map((item, i) =>
                            i === index ? question : item,
                          ),
                        )
                      }
                      onMove={(offset) => move(index, offset)}
                      onDuplicate={() => duplicate(index)}
                      onRemove={() => remove(index)}
                    />
                  </li>
                ))}
              </ol>
            </fieldset>
          )}
        </section>

        {!readOnly && (
          <aside
            aria-labelledby="add-question-heading"
            className="flex flex-col gap-3 self-start rounded-control border border-grey-stroke-weak bg-page-bg p-4 lg:sticky lg:top-4"
          >
            <h2
              id="add-question-heading"
              tabIndex={-1}
              className="text-paragraph-1 font-semibold focus:outline-none"
            >
              Add a question
            </h2>
            <ul className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {QUESTION_TYPE_ORDER.map((type) => (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => add(type)}
                    disabled={drafts.length >= FORM_QUESTIONS_MAX}
                    aria-label={`Add ${QUESTION_TYPES[type].name}`}
                    className="w-full rounded-control border border-grey-stroke-weak px-3 py-2 text-left text-paragraph-2 text-page-text hover:border-brand-stroke-strong hover:bg-brand-fill disabled:cursor-not-allowed disabled:text-grey-off-state"
                  >
                    {QUESTION_TYPES[type].name}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </section>
  );
}
