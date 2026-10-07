"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthFormMessage, {
  type FormMessage,
} from "@/components/auth/AuthFormMessage";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import { AuthMessage } from "@/components/auth/authConstants";
import { FOCUS_RING } from "@/components/auth/authStyles";
import api from "@/lib/api";
import authClient from "@/lib/authClient";
import { cn } from "@/lib/utils";

/** A link styled like the primary auth button. */
const PRIMARY_LINK_CLASS = cn(
  "flex w-full items-center justify-center rounded-control bg-brand-text px-5 py-3 text-mobile-paragraph-1 text-brand-foreground hover:bg-brand-hover",
  FOCUS_RING,
);

export function LogInToAcceptLink({ href }: { href: string }) {
  return (
    <Link href={href} className={PRIMARY_LINK_CLASS}>
      Log in to accept
    </Link>
  );
}

export function ContinueLink() {
  return (
    <Link href="/" className={PRIMARY_LINK_CLASS}>
      Continue
    </Link>
  );
}

/** Accepts the invitation as the signed-in invitee, then goes home. */
export function AcceptInvitationButton({
  invitationId,
}: {
  invitationId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<FormMessage>();
  const pending = message?.kind === "loading";

  const accept = async () => {
    setMessage({ kind: "loading", text: AuthMessage.Loading });
    try {
      const res = await api.invitations[":id"].accept.$post({
        param: { id: invitationId },
      });
      if (!res.ok) {
        setMessage({ kind: "error", text: AuthMessage.AcceptFailed });
        return;
      }
    } catch {
      setMessage({ kind: "error", text: AuthMessage.AcceptFailed });
      return;
    }
    router.push("/");
  };

  return (
    <div className="flex flex-col gap-6">
      <AuthFormMessage message={message} />
      <AuthSubmitButton type="button" pending={pending} onClick={accept}>
        Accept invitation
      </AuthSubmitButton>
    </div>
  );
}

/** Signs out so the invitee can open the link again with their account. */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    try {
      await authClient.signOut();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthSubmitButton type="button" pending={pending} onClick={signOut}>
      Sign out
    </AuthSubmitButton>
  );
}
