"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AuthOrgTagline from "@/core/auth/components/AuthOrgTagline";
import AuthPageIntro from "@/core/auth/components/AuthPageIntro";
import AuthTextField, {
  focusFirstInvalidField,
} from "@/core/auth/components/AuthTextField";
import AuthPasswordField from "@/core/auth/components/AuthPasswordField";
import AuthSubmitButton from "@/core/auth/components/AuthSubmitButton";
import AuthFormMessage, {
  type FormMessage,
} from "@/core/auth/components/AuthFormMessage";
import { AUTH_LINK_CLASS } from "@/core/auth/components/authStyles";
import { AuthMessage } from "@/core/auth/components/authConstants";
import authClient from "@/core/auth/authClient";
import {
  hasErrors,
  validateLogin,
  type FieldErrors,
} from "@/core/auth/authValidation";
import {
  getRedirectPath,
  useRedirectIfSignedIn,
} from "@/core/auth/hooks/useRedirectIfSignedIn";

const WRONG_CREDENTIALS_CODE = "INVALID_EMAIL_OR_PASSWORD";

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
    router.refresh();
  };

  useRedirectIfSignedIn();

  return (
    <>
      <AuthPageIntro title="Login">
        <AuthOrgTagline />
      </AuthPageIntro>
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
