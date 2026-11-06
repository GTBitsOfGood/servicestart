import "dotenv/config";
import { juno } from "@/core/files/junoClient";
import { parseJunoNumericId } from "@/core/files/junoFileUtils";
import { ResponseError } from "juno-sdk/internal/runtime";
import { JunoFileService } from "@/core/files/JunoFileService";
import { setupEmail } from "@/core/email/emailSetup";

async function main() {
  await setupEmail();

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
