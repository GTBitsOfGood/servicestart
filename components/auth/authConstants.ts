/** Form-level messages on the auth pages, shared with their e2e tests. */
export const AuthMessage = {
  Loading: "Loading…",
  WrongCredentials: "That email and password don't match an account.",
  LoginFailed: "Couldn't log in. Check your connection and try again.",
  AccountExists: "Uh-oh, account already exists.",
  AccountCreated: "Yay, account created!",
  SignupFailed: "Couldn't create your account. Try again.",
  ResetEmailSent: "Check your email for a link to reset your password.",
  ResetEmailFailed: "Couldn't send the reset email. Try again.",
  PasswordReset: "Password reset. Taking you to log in…",
  ResetFailed: "Couldn't reset your password. Try again.",
  AcceptFailed: "Couldn't accept the invitation. Try again.",
} as const;

/** Long enough to read a success message before the page moves on. */
export const SUCCESS_REDIRECT_DELAY_MS = 1500;
