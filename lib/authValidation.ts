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

/** One error message per field; a missing key means the field is valid. */
export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

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

const passwordsMatch = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword;

const passwordsMatchRefinement = {
  message: AuthFieldError.PasswordsDontMatch,
  path: ["confirmPassword"],
};

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
  .refine(passwordsMatch, passwordsMatchRefinement);

const resetPasswordSchema = z
  .object({
    password: newPasswordField,
    confirmPassword: z.string().min(1, AuthFieldError.ConfirmPasswordRequired),
  })
  .refine(passwordsMatch, passwordsMatchRefinement);

function firstFieldErrors<Field extends string>(
  error: z.ZodError,
): FieldErrors<Field> {
  const flattened = z.flattenError(error);
  const entries: [string, string][] = [];
  for (const [key, messages] of Object.entries(flattened.fieldErrors)) {
    if (!Array.isArray(messages)) continue;
    const message = messages[0];
    if (typeof message === "string") entries.push([key, message]);
  }
  return Object.fromEntries(entries) as FieldErrors<Field>;
}

function validate<Schema extends z.ZodType>(
  schema: Schema,
  values: z.infer<Schema>,
): FieldErrors<string> {
  const result = schema.safeParse(values);
  if (result.success) return {};
  return firstFieldErrors(result.error);
}

export function validateEmail(email: string): string | undefined {
  const result = emailField.safeParse(email);
  if (result.success) return undefined;
  const message = result.error.issues[0]?.message;
  return typeof message === "string" ? message : undefined;
}

export function hasErrors(errors: FieldErrors<string>): boolean {
  return Object.keys(errors).length > 0;
}

export function validateLogin(values: { email: string; password: string }) {
  return validate(loginSchema, values);
}

export function validateSignup(values: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  return validate(signupSchema, values);
}

export function validateResetPassword(values: {
  password: string;
  confirmPassword: string;
}) {
  return validate(resetPasswordSchema, values);
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
