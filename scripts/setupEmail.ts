import "dotenv/config";
import { setupEmail } from "../lib/emailSetup";

setupEmail().catch((error) => {
  console.error(error instanceof Error ? error.message : "Email setup failed");
  process.exitCode = 1;
});
