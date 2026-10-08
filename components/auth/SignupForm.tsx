"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AuthTextField, {
  focusFirstInvalidField,
} from "@/components/auth/AuthTextField";
import AuthPasswordField from "@/components/auth/AuthPasswordField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthFormMessage, {
  type FormMessage,
} from "@/components/auth/AuthFormMessage";
import { AUTH_LINK_CLASS } from "@/components/auth/authStyles";
import {
  AuthMessage,
  SUCCESS_REDIRECT_DELAY_MS,
} from "@/components/auth/authConstants";
import authClient from "@/lib/authClient";
import {
  PASSWORD_POLICY_HINT,
  hasErrors,
  validateSignup,
  type FieldErrors,
} from "@/lib/authValidation";
import { getSlugFromHost, INVITATION_ID_HEADER } from "@/lib/clientAuthUtils";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

/** BetterAuth's code for an email that already has an account in this org. */
const ACCOUNT_EXISTS_CODE = "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";

type SignupField =
  | "firstName"
  | "lastName"
  | "email"
  | "password"
  | "confirmPassword";

type SignupFormProps = {
  /** Signing up from an invitation: the email is fixed to the invitee's and
   * the new account accepts the invitation. */
  invitation?: { id: string; email: string };
  /** Where "Log in" sends someone who already has an account. */
  loginHref?: string;
};

export default function SignupForm({
  invitation,
  loginHref = "/login",
}: SignupFormProps) {
  const router = useRouter();
  const org = useActiveOrganization();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(invitation?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<SignupField>>({});
  const [message, setMessage] = useState<FormMessage>();
  // Stays blocked after success while the redirect is pending.
  const pending = message?.kind === "loading" || message?.kind === "success";

  useEffect(() => {
    if (message?.kind !== "success") return;
    const timeout = setTimeout(
      () => router.push("/"),
      SUCCESS_REDIRECT_DELAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [message, router]);

  const accountExists = (
    <>
      {AuthMessage.AccountExists}{" "}
      <Link href={loginHref} className={AUTH_LINK_CLASS}>
        Log in instead
      </Link>
    </>
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const fieldErrors = validateSignup({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    });
    setErrors(fieldErrors);
    if (hasErrors(fieldErrors)) {
      setMessage(undefined);
      focusFirstInvalidField(event.currentTarget);
      return;
    }

    setMessage({ kind: "loading", text: AuthMessage.Loading });
    try {
      const { error } = await authClient.signUp.email(
        {
          email: email.trim(),
          password,
          name: `${firstName.trim()} ${lastName.trim()}`,
          organizationSlug: org?.slug || getSlugFromHost(window.location.host),
        },
        invitation && {
          headers: { [INVITATION_ID_HEADER]: invitation.id },
        },
      );
      if (error) {
        setMessage({
          kind: "error",
          text:
            error.code === ACCOUNT_EXISTS_CODE
              ? accountExists
              : AuthMessage.SignupFailed,
        });
        return;
      }
    } catch {
      setMessage({ kind: "error", text: AuthMessage.SignupFailed });
      return;
    }

    setMessage({ kind: "success", text: AuthMessage.AccountCreated });
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-6 tablet:grid-cols-2">
        <AuthTextField
          label="First Name"
          name="first_name"
          autoComplete="given-name"
          placeholder="John"
          value={firstName}
          onChange={setFirstName}
          error={errors.firstName}
        />
        <AuthTextField
          label="Last Name"
          name="last_name"
          autoComplete="family-name"
          placeholder="Smith"
          value={lastName}
          onChange={setLastName}
          error={errors.lastName}
        />
      </div>
      <AuthTextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="example@email.com"
        value={email}
        onChange={setEmail}
        error={errors.email}
        readOnly={invitation !== undefined}
      />
      <AuthPasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        placeholder="Password"
        value={password}
        onChange={setPassword}
        error={errors.password}
        hint={PASSWORD_POLICY_HINT}
      />
      <AuthPasswordField
        label="Confirm Password"
        name="confirm_password"
        autoComplete="new-password"
        placeholder="Re-enter your password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={errors.confirmPassword}
      />
      <AuthFormMessage message={message} />
      <AuthSubmitButton pending={pending}>Create Account</AuthSubmitButton>
      <p className="text-center">
        Already have an account?{" "}
        <Link href={loginHref} className={AUTH_LINK_CLASS}>
          Login
        </Link>
      </p>
    </form>
  );
}
