import { handle } from "hono/netlify";
import { app } from "@/features/app";

// Routes are registered in features/app.ts, not here.
const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
