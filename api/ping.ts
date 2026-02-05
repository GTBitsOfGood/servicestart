import db from "@/lib/db";
import { Hono } from "hono";

const app = new Hono().get("/", async (c) => {
  let dbConnected: boolean = false;
  await db
    .execute(`SELECT 1`)
    .then(() => {
      dbConnected = true;
    })
    .catch((error) => {
      console.error(error);
      dbConnected = false;
    });

  const msg = `DB connected: ${dbConnected}. Branch: ${process.env.NEXT_PUBLIC_BRANCH_NAME}`;

  return c.text(msg);
});

export default app;
