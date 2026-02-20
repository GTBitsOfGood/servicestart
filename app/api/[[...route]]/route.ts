import ping from "@/api/ping";
import joinRequests from "@/api/joinRequests";
import announcements from "@/api/announcements";
import events from "@/api/events";
import media from "@/api/media";
import organizationconfig from "@/api/organizationconfig";
import { Hono } from "hono";
import { handle } from "hono/netlify";

const app = new Hono()
  .basePath("/api")
  .route("/ping", ping)
  .route("/joinRequests", joinRequests)
  .route("/announcements", announcements)
  .route("/events", events)
  .route("/media", media)
  .route("/organizationconfig", organizationconfig);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);

export type AppType = typeof app;

export default app;
