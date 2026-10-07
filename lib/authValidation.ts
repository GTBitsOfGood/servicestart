import { z } from "zod";

/** The password policy BetterAuth enforces; `lib/auth.ts` passes these in. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_POLICY_HINT = `At least ${PASSWORD_MIN_LENGTH} characters.`;

export const AuthFieldError = {
  FirstNameRequired: "Enter your first name.",
  LastNameRequired: "Enter your last name.",
  EmailRequired: "Enter your email.",
  EmailInvalid: "Enter an email like name@example.com.",
  PasswordRequired: "Enter your password.",
  PasswordTooShort: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  PasswordTooLong: `Use at most ${PASSWORD_MAX_LENGTH} characters.`,
  ConfirmPasswordRequired: "Re-enter your password.",
  PasswordsDontMatch: "Passwords don't match.",
} as const;

export type AuthFieldError =
  (typeof AuthFieldError)[keyof typeof AuthFieldError];

/** One error message per field; a missing key means the field is valid. */
export type FieldErrors<Field extends string> = Partial<
  Record<Field, AuthFieldError>
>;

const emailSchema = z.email();

export function validateEmail(email: string): AuthFieldError | undefined {
  if (!email.trim()) return AuthFieldError.EmailRequired;
  if (!emailSchema.safeParse(email.trim()).success) {
    return AuthFieldError.EmailInvalid;
  }
  return undefined;
}

/** Checks a password being set against the server's policy. */
export function validateNewPassword(
  password: string,
): AuthFieldError | undefined {
  if (!password) return AuthFieldError.PasswordRequired;
  if (password.length < PASSWORD_MIN_LENGTH) {
    return AuthFieldError.PasswordTooShort;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return AuthFieldError.PasswordTooLong;
  }
  return undefined;
}

export function validateConfirmPassword(
  password: string,
  confirmPassword: string,
): AuthFieldError | undefined {
  if (!confirmPassword) return AuthFieldError.ConfirmPasswordRequired;
  if (password !== confirmPassword) return AuthFieldError.PasswordsDontMatch;
  return undefined;
}

function compact<Field extends string>(
  errors: Record<Field, AuthFieldError | undefined>,
): FieldErrors<Field> {
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  ) as FieldErrors<Field>;
}

export function hasErrors(errors: FieldErrors<string>): boolean {
  return Object.keys(errors).length > 0;
}

export function validateLogin(values: { email: string; password: string }) {
  return compact({
    email: validateEmail(values.email),
    password: values.password ? undefined : AuthFieldError.PasswordRequired,
  });
}

export function validateSignup(values: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  return compact({
    firstName: values.firstName.trim()
      ? undefined
      : AuthFieldError.FirstNameRequired,
    lastName: values.lastName.trim()
      ? undefined
      : AuthFieldError.LastNameRequired,
    email: validateEmail(values.email),
    password: validateNewPassword(values.password),
    confirmPassword: validateConfirmPassword(
      values.password,
      values.confirmPassword,
    ),
  });
}

export function validateResetPassword(values: {
  password: string;
  confirmPassword: string;
}) {
  return compact({
    password: validateNewPassword(values.password),
    confirmPassword: validateConfirmPassword(
      values.password,
      values.confirmPassword,
    ),
  });
}

/**
 * A same-origin path to return to after logging in, or "/" for anything that
 * would leave `origin`. Parses like the browser does, so tricks such as
 * `//host`, `/\\host` or `/<tab>/host` can't escape.
 */
export function safeRedirectPath(
  redirect: string | null | undefined,
  origin: string,
): string {
  if (!redirect?.startsWith("/")) return "/";
  try {
    const url = new URL(redirect, origin);
    return url.origin === new URL(origin).origin
      ? `${url.pathname}${url.search}${url.hash}`
      : "/";
  } catch {
    return "/";
  }
}
