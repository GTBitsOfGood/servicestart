"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import DynamicForm, {
  type DynamicFormSubmitResult,
} from "@/features/forms/components/DynamicForm";
import FormMessage from "@/features/forms/components/FormMessage";
import api from "@/core/api/client";
import type {
  FormAnswerValue,
  FormDefinition,
} from "@/features/forms/lib/schema";

type FormFillClientProps = {
  definition: Pick<FormDefinition, "formId" | "components">;
  /** Saved draft answers to start a new submission from. */
  initialValues?: Record<string, FormAnswerValue>;
} & (
  | {
      mode?: "submit";
      /** Autosaves this signed-in member's new response as a draft. */
      enableDrafts?: boolean;
    }
  | {
      mode: "edit";
      enableDrafts?: never;
      /** The member's saved answers to start from. */
      initialValues: Record<string, FormAnswerValue>;
      /** Where saved images load from, without a trailing slash. */
      uploadsPath: string;
    }
);

type Answers = Record<string, FormAnswerValue>;

const SUBMIT_FAILED = "Couldn't submit the form.";
const SAVE_FAILED = "Couldn't save your changes.";
const DRAFT_SAVE_DELAY_MS = 2_000;
const DRAFT_RETRY_DELAY_MS = 5_000;

type DraftSaveStatus = "idle" | "saving" | "saved" | "retrying";

function useDraftAutosave({
  enabled,
  formId,
  initialAnswers,
}: {
  enabled: boolean;
  formId: string;
  initialAnswers?: Answers;
}) {
  const [status, setStatus] = useState<DraftSaveStatus>(() =>
    enabled && initialAnswers !== undefined ? "saved" : "idle",
  );
  const [hasDraft, setHasDraft] = useState(
    enabled && initialAnswers !== undefined,
  );
  const answersRef = useRef<Answers>(initialAnswers ?? {});
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const requestRef = useRef<Promise<void> | null>(null);
  const pendingRef = useRef(false);
  const pendingKeepaliveRef = useRef(false);
  const activeRef = useRef(enabled);
  const flushOnExitRef = useRef(false);
  const mountedRef = useRef(false);
  const saveRef = useRef<(keepalive?: boolean) => Promise<void>>(
    async () => {},
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleSave = useCallback(
    (delay: number, keepalive = false) => {
      if (!activeRef.current) return;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void saveRef.current(keepalive);
      }, delay);
    },
    [clearTimer],
  );

  const save = useCallback(
    async (keepalive = false) => {
      clearTimer();
      if (
        (!activeRef.current && !flushOnExitRef.current) ||
        revisionRef.current <= savedRevisionRef.current
      ) {
        return;
      }
      if (requestRef.current) {
        pendingRef.current = true;
        pendingKeepaliveRef.current ||= keepalive;
        await requestRef.current;
        return;
      }

      const revision = revisionRef.current;
      const answers = answersRef.current;
      if (mountedRef.current) setStatus("saving");
      let succeeded = false;

      const request = (async () => {
        try {
          const response = await api.forms[":formId"].draft.$put(
            {
              param: { formId },
              json: { answers },
            },
            { init: { keepalive } },
          );
          if (!response.ok) throw new Error("Draft save failed");

          succeeded = true;
          if (mountedRef.current) setHasDraft(true);
          savedRevisionRef.current = Math.max(
            savedRevisionRef.current,
            revision,
          );
          if (
            mountedRef.current &&
            revisionRef.current === savedRevisionRef.current
          ) {
            setStatus("saved");
          }
        } catch {
          if (mountedRef.current) setStatus("retrying");
        } finally {
          requestRef.current = null;
          const pending = pendingRef.current;
          const pendingKeepalive = pendingKeepaliveRef.current;
          pendingRef.current = false;
          pendingKeepaliveRef.current = false;

          if (pending) {
            if (succeeded || flushOnExitRef.current) {
              void saveRef.current(pendingKeepalive);
            } else if (activeRef.current) {
              scheduleSave(DRAFT_RETRY_DELAY_MS, pendingKeepalive);
            }
          } else if (
            !succeeded &&
            activeRef.current &&
            timerRef.current === null
          ) {
            scheduleSave(DRAFT_RETRY_DELAY_MS, keepalive);
          }
        }
      })();

      requestRef.current = request;
      await request;
    },
    [clearTimer, formId, scheduleSave],
  );
  saveRef.current = save;

  const handleAnswersChange = useCallback(
    (answers: Answers) => {
      if (!activeRef.current) return;
      answersRef.current = answers;
      revisionRef.current += 1;
      if (mountedRef.current) setStatus("idle");
      scheduleSave(DRAFT_SAVE_DELAY_MS);
    },
    [scheduleSave],
  );

  const pause = useCallback(async () => {
    activeRef.current = false;
    clearTimer();
    pendingRef.current = false;
    pendingKeepaliveRef.current = false;
    await requestRef.current;
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (!enabled) return;
    activeRef.current = true;
    const hasUnsavedChanges = revisionRef.current > savedRevisionRef.current;
    if (mountedRef.current) {
      setStatus(hasUnsavedChanges ? "idle" : "saved");
    }
    if (hasUnsavedChanges) scheduleSave(DRAFT_SAVE_DELAY_MS);
  }, [enabled, scheduleSave]);

  const discard = useCallback(async () => {
    if (!enabled) return false;

    // Let an active save finish, then delete it. Pausing also prevents a
    // pending timer or the save's finally block from recreating the draft.
    await pause();
    try {
      const response = await api.forms[":formId"].draft.$delete({
        param: { formId },
      });
      // A missing draft already has the desired result.
      if (!response.ok && response.status !== 404) {
        throw new Error("Draft delete failed");
      }

      answersRef.current = {};
      revisionRef.current = 0;
      savedRevisionRef.current = 0;
      pendingRef.current = false;
      pendingKeepaliveRef.current = false;
      activeRef.current = true;
      if (mountedRef.current) {
        setHasDraft(false);
        setStatus("idle");
      }
      return true;
    } catch {
      resume();
      return false;
    }
  }, [enabled, formId, pause, resume]);

  useEffect(() => {
    mountedRef.current = true;
    activeRef.current = enabled;
    flushOnExitRef.current = false;
    return () => {
      mountedRef.current = false;
      const hasUnsavedChanges = revisionRef.current > savedRevisionRef.current;
      if (enabled && activeRef.current && hasUnsavedChanges) {
        // Client-side navigation doesn't hide the document, so flush the
        // pending revision before disabling the hook. `keepalive` also gives
        // a real page exit the best chance to finish the request.
        flushOnExitRef.current = true;
        void saveRef.current(true);
      }
      activeRef.current = false;
      clearTimer();
    };
  }, [clearTimer, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") void save(true);
    };
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", saveWhenHidden);
  }, [enabled, save]);

  return { status, hasDraft, handleAnswersChange, pause, resume, discard };
}

/** Submits a new response, or saves changes to an existing one. */
export default function FormFillClient(props: FormFillClientProps) {
  const { definition } = props;
  const isEdit = props.mode === "edit";
  const draftsEnabled = !isEdit && props.enableDrafts === true;
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState(props.initialValues);
  const [formVersion, setFormVersion] = useState(0);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const draftAutosave = useDraftAutosave({
    enabled: draftsEnabled,
    formId: definition.formId,
    initialAnswers: props.initialValues,
  });

  useEffect(() => {
    if (confirmation === null) return;
    window.scrollTo({ top: 0 });
    confirmationRef.current?.focus();
  }, [confirmation]);

  const uploadsPath =
    props.mode === "edit"
      ? props.uploadsPath
      : `/api/forms/${encodeURIComponent(definition.formId)}/my-uploads`;
  const imageSrc = useCallback(
    (uploadId: string) => `${uploadsPath}/${encodeURIComponent(uploadId)}`,
    [uploadsPath],
  );

  async function discardDraft() {
    setDiscarding(true);
    setDiscardError(null);
    const discarded = await draftAutosave.discard();
    if (discarded) {
      setInitialValues(undefined);
      // DynamicForm intentionally reads initial values only on mount.
      setFormVersion((version) => version + 1);
    } else {
      setDiscardError("Couldn't discard the draft. Try again.");
    }
    setDiscarding(false);
  }

  async function submit(answers: Answers): Promise<DynamicFormSubmitResult> {
    const failed = isEdit ? SAVE_FAILED : SUBMIT_FAILED;
    if (draftsEnabled) await draftAutosave.pause();
    let submitted = false;
    try {
      const res = isEdit
        ? await api.forms[":formId"].submissions.mine.$put({
            param: { formId: definition.formId },
            json: { answers },
          })
        : await api.forms[":formId"].submissions.$post({
            param: { formId: definition.formId },
            json: { answers },
          });
      if (res.status === 201 && !isEdit) {
        const body = await res.json();
        if ("confirmationMessage" in body) {
          submitted = true;
          setConfirmation(body.confirmationMessage);
          return { ok: true };
        }
      }
      if (res.status === 200 && isEdit) {
        setConfirmation("Your response has been updated.");
        return { ok: true };
      }
      if (res.status === 400) {
        const { error, fieldErrors } = await res.json();
        return { ok: false, error, fieldErrors };
      }
      if (res.status === 404 || res.status === 409) {
        return { ok: false, error: (await res.json()).error };
      }
      // Auth and availability errors come back as plain text.
      const message = await res.text().catch(() => "");
      return { ok: false, error: message || `${failed} Try again.` };
    } catch {
      return {
        ok: false,
        error: `${failed} Check your connection and try again.`,
      };
    } finally {
      if (draftsEnabled && !submitted) draftAutosave.resume();
    }
  }

  if (confirmation !== null) {
    return (
      <div ref={confirmationRef} tabIndex={-1} className="outline-none">
        <FormMessage
          title={isEdit ? "Changes saved" : "Response submitted"}
          role="status"
        >
          {confirmation}
          {isEdit && (
            <>
              {" "}
              <Link
                href="/"
                className="font-semibold text-brand-text underline"
              >
                Back to home
              </Link>
            </>
          )}
        </FormMessage>
      </div>
    );
  }

  const draftStatus = {
    idle: "",
    saving: "Saving…",
    saved: "Saved",
    retrying: "Couldn't save. Retrying…",
  }[draftAutosave.status];

  return (
    <div className="flex flex-col gap-2">
      {draftsEnabled && (
        <>
          <div className="flex min-h-6 items-center justify-between gap-4">
            <p
              role="status"
              aria-live="polite"
              className="text-paragraph-2 text-grey-text-weak"
            >
              {draftStatus}
            </p>
            {draftAutosave.hasDraft && (
              <button
                type="button"
                disabled={discarding}
                onClick={() => void discardDraft()}
                className="text-paragraph-2 font-semibold text-brand-text underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {discarding ? "Discarding…" : "Discard draft"}
              </button>
            )}
          </div>
          {discardError && (
            <p role="alert" className="text-paragraph-2 text-status-red-text">
              {discardError}
            </p>
          )}
        </>
      )}
      <DynamicForm
        key={formVersion}
        definition={definition}
        onSubmit={submit}
        onAnswersChange={
          draftsEnabled ? draftAutosave.handleAnswersChange : undefined
        }
        initialValues={initialValues}
        disabled={discarding}
        imageSrc={imageSrc}
        {...(props.mode === "edit"
          ? {
              submitLabel: "Save changes",
              submittingLabel: "Saving…",
            }
          : {})}
      />
    </div>
  );
}
