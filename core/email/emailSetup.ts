import { ResponseError } from "juno-sdk/internal/runtime";
import { getEmailSenderDomain, requireEnv } from "@/core/utils/env";
import { juno } from "@/core/files/junoClient";

export async function setupEmail() {
  const sendgridKey = requireEnv("SENDGRID_KEY");
  const domain = getEmailSenderDomain();
  requireEnv("JUNO_API_KEY");
  await juno.email.setupEmail({ sendgridKey });
  const registration = await juno.email.registerDomain({
    domain,
    subdomain: "mail",
  });
  console.log(`Domain ID: ${registration.id}`);
  console.log(
    "Default local Juno simulates email. Its DNS records are fake; do not publish them. See README.md for real email setup.",
  );
  for (const [name, record] of Object.entries(registration.records ?? {})) {
    console.log(name, record);
  }
}

/**
 * Why Juno rejected an email setup call, safe to log. When SendGrid rejects a
 * request, Juno's error body is the serialized HTTP error, which can include
 * the request's Authorization header (the SendGrid key). So this keeps only
 * Juno's status and SendGrid's status and error code, never the body itself.
 */
export async function describeJunoRejection(error: ResponseError) {
  let description = `Juno responded ${error.response.status}`;
  try {
    const { status, code } = JSON.parse(await error.response.text()) as {
      status?: unknown;
      code?: unknown;
    };
    if (typeof status === "number") {
      description += `; SendGrid responded ${status}`;
    }
    if (typeof code === "string" && /^[A-Z_]+$/.test(code)) {
      description += ` (${code})`;
    }
  } catch {
    // Not a serialized SendGrid error; Juno's status is all there is.
  }
  return description;
}

/**
 * setupEmail, except that with ALLOW_EMAIL_SETUP_FAILURE=true, Juno rejecting
 * a request is reported as a GitHub Actions warning instead of thrown. Missing
 * configuration still throws. Only the preview workflow sets the flag, as a
 * stopgap while SendGrid rejects the shared sender domain (#342); remove it
 * from the workflow once that's fixed.
 */
export async function setupEmailUnlessAllowedToFail() {
  try {
    await setupEmail();
  } catch (error) {
    if (
      !(error instanceof ResponseError) ||
      process.env.ALLOW_EMAIL_SETUP_FAILURE?.trim() !== "true"
    ) {
      throw error;
    }
    console.warn(
      `::warning title=Email setup failed (#342)::${await describeJunoRejection(error)}. Continuing because ALLOW_EMAIL_SETUP_FAILURE is set.`,
    );
  }
}
