import "dotenv/config";
import { juno } from "../lib/junoClient";
import { FileService } from "../lib/services/FileService";
import { parseJunoNumericId } from "../lib/services/junoFileUtils";

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

  const projectId = process.env.JUNO_PROJECT_ID?.trim();
  const organizationId = process.env.SETUP_ORGANIZATION_ID?.trim();
  const fileProviderName = process.env.FILE_PROVIDER_NAME?.trim();

  if (!projectId) {
    console.warn(
      "JUNO_PROJECT_ID is not set; skipping Juno file bucket registration.",
    );
    return;
  }
  if (!organizationId) {
    console.warn(
      "SETUP_ORGANIZATION_ID is not set; skipping Juno file bucket registration.",
    );
    return;
  }
  if (!fileProviderName) {
    throw new Error(
      "FILE_PROVIDER_NAME is required to register an organization file bucket",
    );
  }

  const fileConfig = await juno.file.getConfig(projectId);
  const configId = parseJunoNumericId(fileConfig.id);
  if (!Number.isFinite(configId)) {
    throw new Error("Juno returned an invalid file config ID");
  }

  const bucketName = FileService.getBucketName(organizationId);

  await juno.file.registerBucket({
    name: bucketName,
    configId,
    fileProviderName,
  });

  console.log(
    `Registered file bucket "${bucketName}" (organization ${organizationId}). configId=${configId}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
