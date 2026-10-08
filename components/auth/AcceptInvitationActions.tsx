"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthFormMessage, {
  type FormMessage,
} from "@/components/auth/AuthFormMessage";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import { AuthMessage } from "@/components/auth/authConstants";
import api from "@/lib/api";
import authClient from "@/lib/authClient";

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
      const { organizationId } = (await res.json()) as {
        organizationId: string;
      };
      const { error: activeOrgError } = await authClient.organization.setActive(
        {
          organizationId,
        },
      );
      if (activeOrgError) {
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
  const [message, setMessage] = useState<FormMessage>();
  const pending = message?.kind === "loading";

  const signOut = async () => {
    setMessage({ kind: "loading", text: AuthMessage.Loading });
    try {
      const { error } = await authClient.signOut();
      if (error) {
        setMessage({ kind: "error", text: AuthMessage.SignOutFailed });
        return;
      }
      router.refresh();
      setMessage(undefined);
    } catch {
      setMessage({ kind: "error", text: AuthMessage.SignOutFailed });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <AuthFormMessage message={message} />
      <AuthSubmitButton type="button" pending={pending} onClick={signOut}>
        Sign out
      </AuthSubmitButton>
    </div>
  );
}
