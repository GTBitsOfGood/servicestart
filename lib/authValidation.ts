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

const emailField = z
  .string()
  .trim()
  .min(1, AuthFieldError.EmailRequired)
  .pipe(z.email(AuthFieldError.EmailInvalid));

const newPasswordField = z
  .string()
  .min(1, AuthFieldError.PasswordRequired)
  .min(PASSWORD_MIN_LENGTH, AuthFieldError.PasswordTooShort)
  .max(PASSWORD_MAX_LENGTH, AuthFieldError.PasswordTooLong);

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, AuthFieldError.PasswordRequired),
});

const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, AuthFieldError.FirstNameRequired),
    lastName: z.string().trim().min(1, AuthFieldError.LastNameRequired),
    email: emailField,
    password: newPasswordField,
    confirmPassword: z.string().min(1, AuthFieldError.ConfirmPasswordRequired),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: AuthFieldError.PasswordsDontMatch,
    path: ["confirmPassword"],
  });

const resetPasswordSchema = z
  .object({
    password: newPasswordField,
    confirmPassword: z.string().min(1, AuthFieldError.ConfirmPasswordRequired),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: AuthFieldError.PasswordsDontMatch,
    path: ["confirmPassword"],
  });

function fieldErrorsFromZod<Field extends string>(
  error: z.ZodError,
): FieldErrors<Field> {
  const flattened = z.flattenError(error);
  const result: FieldErrors<Field> = {};
  const fieldErrors = flattened.fieldErrors as Partial<
    Record<string, string[] | undefined>
  >;
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const message = messages?.[0];
    if (message) result[key as Field] = message as AuthFieldError;
  }
  return result;
}

export function validateEmail(email: string): AuthFieldError | undefined {
  const result = emailField.safeParse(email);
  if (result.success) return undefined;
  return result.error.issues[0]?.message as AuthFieldError;
}

export function hasErrors(errors: FieldErrors<string>): boolean {
  return Object.keys(errors).length > 0;
}

export function validateLogin(values: { email: string; password: string }) {
  const result = loginSchema.safeParse(values);
  if (result.success) return {};
  return fieldErrorsFromZod(result.error);
}

export function validateSignup(values: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const result = signupSchema.safeParse(values);
  if (result.success) return {};
  return fieldErrorsFromZod(result.error);
}

export function validateResetPassword(values: {
  password: string;
  confirmPassword: string;
}) {
  const result = resetPasswordSchema.safeParse(values);
  if (result.success) return {};
  return fieldErrorsFromZod(result.error);
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
