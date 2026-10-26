"use client";

import { useId, useState } from "react";
import ThemedButton from "@/components/theme/ThemedButton";
import ThemedModal from "@/components/theme/ThemedModal";
import api from "@/lib/api";

type RequestState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

/** Asks a member to complete a form they haven't submitted. */
export default function RequestInformationModal({
  userId,
  memberName,
  form,
}: {
  userId: string;
  memberName: string;
  form: { formId: string; title: string };
}) {
  const messageId = useId();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<RequestState>({ kind: "idle" });

  async function send() {
    setState({ kind: "sending" });
    try {
      const response = await api.informationRequests.$post({
        json: { userId, formId: form.formId, message },
      });
      if (response.ok) {
        setState({ kind: "sent" });
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setState({
        kind: "error",
        message: body?.error ?? "Unable to send the request",
      });
    } catch {
      setState({ kind: "error", message: "Unable to send the request" });
    }
  }

  const sent = state.kind === "sent";
  return (
    <ThemedModal
      openState={{ open, setOpen }}
      onOpenChange={(value) => {
        if (value) {
          setMessage("");
          setState({ kind: "idle" });
        }
      }}
      trigger={
        <ThemedButton
          variant="secondary"
          size="small"
          aria-label={`Request Information for ${form.title}`}
        >
          Request Information
        </ThemedButton>
      }
      title={<h2>Request Information</h2>}
      description={
        <div className="flex flex-col gap-4 text-grey-text-strong">
          <p>
            Ask {memberName} to complete{" "}
            <span className="font-semibold">{form.title}</span>.
          </p>
          {sent ? (
            <p role="status" className="text-status-green-text">
              Request sent. {memberName} will see it in their notifications.
            </p>
          ) : (
            <>
              <label htmlFor={messageId} className="flex flex-col gap-2">
                Message (optional)
                <textarea
                  id={messageId}
                  value={message}
                  maxLength={1000}
                  rows={4}
                  disabled={state.kind === "sending"}
                  onChange={(event) => setMessage(event.target.value)}
                  className="w-full rounded border border-grey-stroke-weak bg-solid-bg-base p-2 text-grey-text-strong"
                />
              </label>
              {state.kind === "error" && (
                <p role="alert" className="text-status-red-text">
                  {state.message}
                </p>
              )}
            </>
          )}
        </div>
      }
      primaryLabel={
        sent ? "Done" : state.kind === "sending" ? "Sending…" : "Send"
      }
      secondaryLabel={sent ? "Close" : "Cancel"}
      primaryDisabled={state.kind === "sending"}
      onPrimary={sent ? () => setOpen(false) : () => void send()}
    />
  );
}
