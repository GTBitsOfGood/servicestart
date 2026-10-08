"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AuthOrgTagline from "@/components/auth/AuthOrgTagline";
import AuthPageIntro from "@/components/auth/AuthPageIntro";
import AuthTextField, {
  focusFirstInvalidField,
} from "@/components/auth/AuthTextField";
import AuthPasswordField from "@/components/auth/AuthPasswordField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthFormMessage, {
  type FormMessage,
} from "@/components/auth/AuthFormMessage";
import { AUTH_LINK_CLASS } from "@/components/auth/authStyles";
import { AuthMessage } from "@/components/auth/authConstants";
import authClient from "@/lib/authClient";
import {
  hasErrors,
  safeRedirectPath,
  validateLogin,
  type FieldErrors,
} from "@/lib/authValidation";
import { useRedirectIfSignedIn } from "@/lib/hooks/useRedirectIfSignedIn";

const WRONG_CREDENTIALS_CODE = "INVALID_EMAIL_OR_PASSWORD";

function getRedirectPath() {
  return safeRedirectPath(
    new URLSearchParams(window.location.search).get("redirect"),
    window.location.origin,
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
  const [message, setMessage] = useState<FormMessage>();
  const pending = message?.kind === "loading";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const fieldErrors = validateLogin({ email, password });
    setErrors(fieldErrors);
    if (hasErrors(fieldErrors)) {
      setMessage(undefined);
      focusFirstInvalidField(event.currentTarget);
      return;
    }

    setMessage({ kind: "loading", text: AuthMessage.Loading });
    try {
      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (error) {
        setMessage({
          kind: "error",
          text:
            error.code === WRONG_CREDENTIALS_CODE
              ? AuthMessage.WrongCredentials
              : AuthMessage.LoginFailed,
        });
        return;
      }
    } catch {
      setMessage({ kind: "error", text: AuthMessage.LoginFailed });
      return;
    }
    router.push(getRedirectPath());
  };

  useRedirectIfSignedIn(getRedirectPath);

  return (
    <>
      <div className="flex flex-col gap-3 bg-page-bg">
        <AuthPageIntro title="Login" />
        <AuthOrgTagline />
      </div>
      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <AuthTextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="example@email.com"
          value={email}
          onChange={setEmail}
          error={errors.email}
        />
        <div className="flex flex-col gap-3">
          <AuthPasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={setPassword}
            error={errors.password}
          />
          <Link
            href="/forgotpassword"
            className={`self-end text-mobile-paragraph-2 ${AUTH_LINK_CLASS}`}
          >
            Forgot Password?
          </Link>
        </div>
        <AuthFormMessage message={message} />
        <AuthSubmitButton pending={pending}>Login</AuthSubmitButton>
        <p className="text-center">
          Don&rsquo;t have an account?{" "}
          <Link href="/signup" className={AUTH_LINK_CLASS}>
            Create Account
          </Link>
        </p>
      </form>
    </>
  );
}
