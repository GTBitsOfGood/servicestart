import { app } from "@/lib/app";
import { handle } from "hono/netlify";

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
