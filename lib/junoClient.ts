import junoSdk from "juno-sdk";
import { requireEnv } from "./env";

const junoApiKey = process.env.JUNO_API_KEY?.trim();
const junoBaseUrl = process.env.JUNO_BASE_URL?.trim();

junoSdk.init({
  apiKey: junoApiKey!,
  ...(junoBaseUrl ? { baseURL: junoBaseUrl } : {}),
});

// Importing auth/seed code must not require provisioning credentials. Validate
// when a Juno service is accessed, before any request can be sent.
export const juno = new Proxy(junoSdk, {
  get(target, property, receiver) {
    requireEnv("JUNO_API_KEY");
    return Reflect.get(target, property, receiver);
  },
});
