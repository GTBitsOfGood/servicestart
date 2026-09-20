"use client";

import { useState, useTransition } from "react";
import BogButton from "@/components/bog/BogButton/BogButton";

export type RegisterState = {
  registered: boolean;
  isFull: boolean;
  isDeadlinePassed: boolean;
  /** Set when the last attempt was refused, e.g. the event filled up. */
  message?: string;
};

type RegisterButtonProps = {
  initialState: RegisterState;
  onRegister: () => Promise<RegisterState>;
};

export default function RegisterButton({
  initialState,
  onRegister,
}: RegisterButtonProps) {
  const [state, setState] = useState(initialState);
  const [isPending, startTransition] = useTransition();

  const label = state.registered
    ? "Unregister"
    : state.isFull
      ? "Event Full"
      : state.isDeadlinePassed
        ? "Registration Closed"
        : "Register";

  const isDisabled =
    (!state.registered && (state.isFull || state.isDeadlinePassed)) ||
    (state.registered && state.isDeadlinePassed) ||
    isPending;

  return (
    <div className="flex flex-col items-end gap-2">
      <BogButton
        type="button"
        variant="primary"
        size="small"
        className="px-10 py-3 text-xl bg-brand-text text-white"
        disabled={isDisabled}
        onClick={() => {
          startTransition(async () => {
            const nextState = await onRegister();
            setState(nextState);
          });
        }}
      >
        {isPending ? "Saving…" : label}
      </BogButton>
      {state.message && (
        <p role="alert" className="text-small text-status-red-text">
          {state.message}
        </p>
      )}
    </div>
  );
}
