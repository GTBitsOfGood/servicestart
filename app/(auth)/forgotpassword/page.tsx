"use client";

import { useState, type FormEvent } from "react";
import AuthPageIntro from "@/components/auth/AuthPageIntro";
import AuthTextField, {
  focusFirstInvalidField,
} from "@/components/auth/AuthTextField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthFormMessage, {
  type FormMessage,
} from "@/components/auth/AuthFormMessage";
import BackToLoginLink from "@/components/auth/BackToLoginLink";
import { AuthMessage } from "@/components/auth/authConstants";
import authClient from "@/lib/authClient";
import { validateEmail } from "@/lib/authValidation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [message, setMessage] = useState<FormMessage>();
  const pending = message?.kind === "loading";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const error = validateEmail(email);
    setEmailError(error);
    if (error) {
      setMessage(undefined);
      focusFirstInvalidField(event.currentTarget);
      return;
    }

    setMessage({ kind: "loading", text: AuthMessage.Loading });
    try {
      const { error: requestError } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/resetpassword",
      });
      setMessage(
        requestError
          ? { kind: "error", text: AuthMessage.ResetEmailFailed }
          : { kind: "success", text: AuthMessage.ResetEmailSent },
      );
    } catch {
      setMessage({ kind: "error", text: AuthMessage.ResetEmailFailed });
    }
  };

  return (
    <>
      <AuthPageIntro
        title="Reset Password"
        description="Enter your email to receive a password reset link."
      />
      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <AuthTextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="example@email.com"
          value={email}
          onChange={setEmail}
          error={emailError}
        />
        <AuthFormMessage message={message} />
        <AuthSubmitButton pending={pending}>Send Reset Link</AuthSubmitButton>
        <BackToLoginLink />
      </form>
    </>
  );
}
