import "dotenv/config";
import { juno } from "../lib/services/junoClient";

const sendgridKey = process.env.SENDGRID_KEY?.trim();

if (!sendgridKey) {
  throw new Error("SENDGRID_KEY environment variable is not set");
}

const senderDomain = (
  process.env.EMAIL_SENDER_DOMAIN?.trim() ||
  new URL(
    process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000",
  ).hostname
).toLowerCase();

async function main() {
  await juno.email.setupEmail({ sendgridKey: sendgridKey! });

  const registration = await juno.email.registerDomain({
    domain: senderDomain,
    subdomain: "mail",
  });

  console.log(`Domain ID: ${registration.id}`);

  if (registration.records?.mailCname) {
    console.log("mail_cname", registration.records.mailCname);
  }

  if (registration.records?.dkim1) {
    console.log("dkim1", registration.records.dkim1);
  }

  if (registration.records?.dkim2) {
    console.log("dkim2", registration.records.dkim2);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
