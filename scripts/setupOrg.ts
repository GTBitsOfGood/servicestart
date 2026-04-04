import "dotenv/config";
import { juno } from "../lib/junoClient";
import { FileService } from "../lib/services/FileService";
import { parseJunoNumericId } from "../lib/services/junoFileUtils";
import { ResponseError } from "juno-sdk/internal/runtime";
import { JunoFileService } from "@/lib/services/JunoFileService";

const sendgridKey = process.env.SENDGRID_KEY?.trim();

if (!sendgridKey) {
  throw new Error("SENDGRID_KEY environment variable is not set");
}

const senderDomain = process.env.EMAIL_SENDER_DOMAIN
  ? process.env.EMAIL_SENDER_DOMAIN?.trim().toLowerCase()
  : undefined;

async function main() {
  await juno.email.setupEmail({ sendgridKey: sendgridKey! });
  if (!senderDomain) {
    console.warn(
      "EMAIL_SENDER_DOMAIN is required to register a domain in Sendgrid. Skipping domain registration.",
    );
  } else {
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
  console.log("File config", fileConfig);
  const configId = parseJunoNumericId(fileConfig.id);
  if (!Number.isFinite(configId)) {
    throw new Error("Juno returned an invalid file config ID");
  }

  const bucketName = JunoFileService.getBucketName(organizationId);
  console.log(
    `Registering file bucket "${bucketName}" for organization ${organizationId}...`,
  );

  const buckets = await juno.file.getBucketsByConfigIdAndEnv(String(configId));
  console.log("Buckets", buckets);

  if (buckets.some((bucket) => bucket.name === bucketName)) {
    console.log(
      `File bucket "${bucketName}" already exists for organization ${organizationId}. Skipping registration.`,
    );
    return;
  }

  try {
    await juno.file.registerBucket({
      name: bucketName,
      configId,
      fileProviderName,
    });
  } catch (error) {
    if (error instanceof ResponseError) {
      console.error(await error.response.text());
    }
    throw error;
  }

  console.log(
    `Registered file bucket "${bucketName}" (organization ${organizationId}). configId=${configId}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
