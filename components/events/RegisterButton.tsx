"use client";

import { useState, useTransition } from "react";
import BogButton from "@/components/bog/BogButton/BogButton";

type RegisterState = {
  registered: boolean;
  isFull: boolean;
  isDeadlinePassed: boolean;
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
    isPending;

  return (
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
      {label}
    </BogButton>
  );
}
