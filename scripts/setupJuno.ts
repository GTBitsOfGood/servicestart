import { exec, execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import "dotenv/config";

let junoProcess: ReturnType<typeof exec>;

async function main() {
  console.log("Setting up Juno...");

  console.log("Installing packages...");
  execSync("cd juno && pnpm i", { stdio: "inherit" });

  console.log("Packages installed. Starting Juno...");
  junoProcess = exec("pnpm run juno:start", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error starting Juno: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`[Juno stderr]: ${stderr}`);
      return;
    }
    console.log(`[Juno stdout]: ${stdout}`);
  });

  console.log("Creating API key...");
  const res = await fetch(`${process.env.JUNO_BASE_URL}/auth/key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Email": "test-superadmin@test.com",
      "X-User-Password": "test-password",
    },
    body: JSON.stringify({
      environment: "prod",
      project: {
        name: "test-seed-project",
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Error creating API key:", res.status, res.statusText);
    console.error("Response body:", errorText);
    throw new Error(
      `Failed to create API key: ${res.status} ${res.statusText}`,
    );
  }

  const { apiKey }: { apiKey: string } = await res.json().catch((error) => {
    console.error("Error parsing API key response:", error);
    console.log("Juno response:", res);
    throw error;
  });

  console.log("API key created. Storing in .env...");

  // Read .env, find line beginning with JUNO_API_KEY= and replace it with JUNO_API_KEY=${string}
  const envFile = await fs.readFile(".env", "utf-8");
  const newEnvFile = envFile.replace(
    /^JUNO_API_KEY=.*$/m,
    `JUNO_API_KEY=${apiKey}`,
  );
  await fs.writeFile(".env", newEnvFile);

  console.log("API key stored in .env. Juno setup complete.");

  junoProcess.kill();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);

    junoProcess?.kill();
    process.exit(1);
  });
