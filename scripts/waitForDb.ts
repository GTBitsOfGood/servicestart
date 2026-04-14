import { Client } from "pg";

const [, , dbUrlArg, timeoutArg] = process.argv;

const dbUrl = dbUrlArg ?? process.env.DB_URL;
const timeoutMs = Number(timeoutArg ?? 30_000);
const pollIntervalMs = 1_000;

if (!dbUrl) {
  console.error("waitForDb: missing database URL");
  process.exit(1);
}

async function canConnect(url: string) {
  const client = new Client({
    connectionString: url,
  });

  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await canConnect(dbUrl)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  console.error(
    `waitForDb: database did not become ready within ${timeoutMs}ms`,
  );
  process.exit(1);
}

void main();
