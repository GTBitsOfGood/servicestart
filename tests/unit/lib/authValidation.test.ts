// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AuthFieldError,
  PASSWORD_MIN_LENGTH,
  safeRedirectPath,
  validateEmail,
  validateLogin,
  validateResetPassword,
  validateSignup,
} from "@/lib/authValidation";

const VALID_PASSWORD = "a".repeat(PASSWORD_MIN_LENGTH);

describe(validateEmail, () => {
  it.each([
    ["", AuthFieldError.EmailRequired],
    ["   ", AuthFieldError.EmailRequired],
    ["not-an-email", AuthFieldError.EmailInvalid],
    ["name@", AuthFieldError.EmailInvalid],
  ])("rejects %j", (email, error) => {
    expect(validateEmail(email)).toBe(error);
  });

  it("accepts an email with surrounding spaces", () => {
    expect(validateEmail(" name@example.com ")).toBeUndefined();
  });
});

describe(validateLogin, () => {
  it("requires both fields", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: AuthFieldError.EmailRequired,
      password: AuthFieldError.PasswordRequired,
    });
  });

  it("doesn't apply the new-password policy to an existing password", () => {
    expect(
      validateLogin({ email: "a@example.com", password: "short" }),
    ).toEqual({});
  });
});

describe(validateSignup, () => {
  const valid = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
  };

  it("accepts a complete form", () => {
    expect(validateSignup(valid)).toEqual({});
  });

  it("uses the server's minimum password length", () => {
    const short = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    expect(
      validateSignup({ ...valid, password: short, confirmPassword: short }),
    ).toEqual({ password: AuthFieldError.PasswordTooShort });
  });

  it("requires matching passwords", () => {
    expect(
      validateSignup({ ...valid, confirmPassword: `${VALID_PASSWORD}x` }),
    ).toEqual({ confirmPassword: AuthFieldError.PasswordsDontMatch });
  });

  it("requires names", () => {
    expect(validateSignup({ ...valid, firstName: " ", lastName: "" })).toEqual({
      firstName: AuthFieldError.FirstNameRequired,
      lastName: AuthFieldError.LastNameRequired,
    });
  });
});

describe(validateResetPassword, () => {
  it("accepts matching passwords", () => {
    expect(
      validateResetPassword({
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      }),
    ).toEqual({});
  });

  it("requires matching passwords", () => {
    expect(
      validateResetPassword({
        password: VALID_PASSWORD,
        confirmPassword: `${VALID_PASSWORD}x`,
      }),
    ).toEqual({ confirmPassword: AuthFieldError.PasswordsDontMatch });
  });
});

describe(safeRedirectPath, () => {
  const ORIGIN = "http://acme.lvh.me:3000";

  it("keeps a same-site path", () => {
    expect(safeRedirectPath("/accept-invitation/abc?x=1", ORIGIN)).toBe(
      "/accept-invitation/abc?x=1",
    );
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\t\\evil.example",
  ])("falls back to / for %j", (redirect) => {
    expect(safeRedirectPath(redirect, ORIGIN)).toBe("/");
  });
});
