import "dotenv/config";
import db from "@/lib/db";

async function main() {
  await db.execute(`SELECT 1`);

  console.log("Database connection successful!");
  process.exit(0);
}

main();
