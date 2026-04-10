import "dotenv/config";
import { juno } from "../lib/junoClient";
import { buildAzureBlobBaseUrl } from "../lib/services/junoFileUtils";

/**
 * Azure Blob Storage endpoint for the storage account.
 * Format: https://{storageAccountName}.blob.core.windows.net
 * @see https://learn.microsoft.com/en-us/rest/api/storageservices/get-blob
 */
function getAzureBlobBaseUrl(): string {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  if (!accountName) {
    throw new Error(
      "AZURE_STORAGE_ACCOUNT_NAME environment variable is not set",
    );
  }

  return buildAzureBlobBaseUrl(accountName);
}

async function main() {
  const providerName = process.env.FILE_PROVIDER_NAME?.trim();
  const providerType = "Azure";
  const publicAccessKey = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const privateAccessKey = process.env.AZURE_STORAGE_ACCOUNT_KEY?.trim();

  if (!providerName) {
    throw new Error("FILE_PROVIDER_NAME environment variable is not set");
  }
  if (!publicAccessKey || !privateAccessKey) {
    throw new Error(
      "AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY must be set",
    );
  }

  await juno.file.setup();

  const baseUrl = getAzureBlobBaseUrl();

  await juno.file.registerProvider({
    baseUrl,
    providerName,
    type: providerType,
    accessKey: {
      publicAccessKey,
      privateAccessKey,
    },
  });

  console.log(
    `Juno file setup complete. Provider "${providerName}" registered.`,
  );
  console.log(`Azure blob base URL: ${baseUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
