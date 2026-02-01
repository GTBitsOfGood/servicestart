import db from "@/lib/db";

export async function GET() {
  let dbConnected: boolean = false;
  await db
    .execute(`SELECT 1`)
    .then(() => {
      dbConnected = true;
    })
    .catch(() => {
      dbConnected = false;
    });

  const msg = `DB connected: ${dbConnected}. Branch: ${process.env.NEXT_PUBLIC_BRANCH_NAME}`;

  return new Response(msg);
}
