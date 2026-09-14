import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getEmailSenderDomain, requireEnv } from "./env";
import { juno } from "./junoClient";

export async function setupEmail({
  recordsDirectory = "docs/email-dns",
}: { recordsDirectory?: string } = {}) {
  const sendgridKey = requireEnv("SENDGRID_KEY");
  const domain = getEmailSenderDomain();
  requireEnv("JUNO_API_KEY");
  await juno.email.setupEmail({ sendgridKey });
  const registration = await juno.email.registerDomain({
    domain,
    subdomain: "mail",
  });
  await mkdir(recordsDirectory, { recursive: true });
  const recordsPath = join(
    recordsDirectory,
    `${encodeURIComponent(domain)}-${randomUUID()}.json`,
  );
  await writeFile(
    recordsPath,
    JSON.stringify(
      {
        domain,
        subdomain: "mail",
        id: registration.id,
        recordedAt: new Date().toISOString(),
        notice:
          "Provider response only. Confirm live SendGrid configuration before publishing; local Juno can return simulated records.",
        records: registration.records ?? {},
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  console.log(
    `Domain ID: ${registration.id}; DNS records saved to ${recordsPath}`,
  );
  console.log(
    "Default local Juno simulates email. Its DNS records are fake; do not publish them. See README.md for real email setup.",
  );
  for (const [name, record] of Object.entries(registration.records ?? {})) {
    console.log(name, record);
  }
}
