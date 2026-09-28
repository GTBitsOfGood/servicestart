import { getEmailSenderDomain, requireEnv } from "./env";
import { juno } from "./junoClient";

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
