import junoSdk from "juno-sdk";

const junoApiKey = process.env.JUNO_API_KEY?.trim();

if (!junoApiKey) {
  throw new Error("JUNO_API_KEY environment variable is not set");
}

const junoBaseUrl = process.env.JUNO_BASE_URL?.trim();

junoSdk.init({
  apiKey: junoApiKey,
  ...(junoBaseUrl ? { baseURL: junoBaseUrl } : {}),
});

export const juno = junoSdk;
