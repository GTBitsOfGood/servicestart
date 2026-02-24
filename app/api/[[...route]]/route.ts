import ping from "@/api/ping";
import joinRequests from "@/api/joinRequests";
import announcements from "@/api/announcements";
import events from "@/api/events";
import shifts from "@/api/shifts";
import media from "@/api/media";
import notifications from "@/api/notifications";
import organizationConfig from "@/api/organizationConfig";
import { Hono } from "hono";
import { handle } from "hono/netlify";

const app = new Hono()
  .basePath("/api")
  .route("/ping", ping)
  .route("/joinRequests", joinRequests)
  .route("/announcements", announcements)
  .route("/events", events)
  .route("/organizationConfig", organizationConfig)
  .route("/shifts", shifts)
  .route("/notifications", notifications)
  .route("/media", media);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
