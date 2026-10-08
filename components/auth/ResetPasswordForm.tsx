"use client";

import { useState, type FormEvent } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthPasswordField from "@/components/auth/AuthPasswordField";
import { focusFirstInvalidField } from "@/components/auth/AuthTextField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthFormMessage, {
  type FormMessage,
} from "@/components/auth/AuthFormMessage";
import BackToLoginLink from "@/components/auth/BackToLoginLink";
import {
  AuthMessage,
  SUCCESS_REDIRECT_DELAY_MS,
} from "@/components/auth/authConstants";
import authClient from "@/lib/authClient";
import { useDelayedRedirect } from "@/lib/hooks/useDelayedRedirect";
import {
  PASSWORD_POLICY_HINT,
  hasErrors,
  validateResetPassword,
  type FieldErrors,
} from "@/lib/authValidation";

/** BetterAuth's code for a reset token that's expired or already used. */
const INVALID_TOKEN_CODE = "INVALID_TOKEN";

/** The reset form for the `token` from the emailed link; null when missing. */
export default function ResetPasswordForm({ token }: { token: string | null }) {
  const scheduleRedirect = useDelayedRedirect();
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<
    FieldErrors<"password" | "confirmPassword">
  >({});
  const [message, setMessage] = useState<FormMessage>();
  const pending = message?.kind === "loading" || message?.kind === "success";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !token) return;

    const fieldErrors = validateResetPassword({ password, confirmPassword });
    setErrors(fieldErrors);
    if (hasErrors(fieldErrors)) {
      setMessage(undefined);
      focusFirstInvalidField(event.currentTarget);
      return;
    }

    setMessage({ kind: "loading", text: AuthMessage.Loading });
    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (error?.code === INVALID_TOKEN_CODE) {
        setExpired(true);
        return;
      }
      if (error) {
        setMessage({ kind: "error", text: AuthMessage.ResetFailed });
        return;
      }
    } catch {
      setMessage({ kind: "error", text: AuthMessage.ResetFailed });
      return;
    }

    setMessage({ kind: "success", text: AuthMessage.PasswordReset });
    scheduleRedirect("/login", SUCCESS_REDIRECT_DELAY_MS);
  };

  if (token === null || expired) {
    return (
      <AuthLayout
        title="Link Expired"
        description="To reset your password, go back to login and select “Forgot Password?” to get a new link."
      >
        <BackToLoginLink />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset Password"
      description="Choose a new password, different from your previous one."
    >
      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <AuthPasswordField
          label="New Password"
          name="password"
          autoComplete="new-password"
          placeholder="Enter a new password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          hint={PASSWORD_POLICY_HINT}
        />
        <AuthPasswordField
          label="Confirm Password"
          name="passwordConfirm"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={errors.confirmPassword}
        />
        <AuthFormMessage message={message} />
        <AuthSubmitButton pending={pending}>Reset Password</AuthSubmitButton>
        <BackToLoginLink />
      </form>
    </AuthLayout>
  );
}
