import ping from "@/lib/ping/ping";
import { Hono } from "hono";
import { handle } from "hono/netlify";

const app = new Hono().basePath("/api").route("/ping", ping);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);

export type AppType = typeof app;
