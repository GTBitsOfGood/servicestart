"use client";

import { useState, type FormEvent } from "react";
import AuthPageIntro from "@/core/auth/components/AuthPageIntro";
import AuthTextField, {
  focusFirstInvalidField,
} from "@/core/auth/components/AuthTextField";
import AuthSubmitButton from "@/core/auth/components/AuthSubmitButton";
import AuthFormMessage, {
  type FormMessage,
} from "@/core/auth/components/AuthFormMessage";
import BackToLoginLink from "@/core/auth/components/BackToLoginLink";
import { AuthMessage } from "@/core/auth/components/authConstants";
import authClient from "@/core/auth/authClient";
import { validateEmail } from "@/core/auth/authValidation";

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
