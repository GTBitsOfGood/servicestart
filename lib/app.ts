import ping from "@/api/ping";
import joinRequests from "@/api/joinRequests";
import announcements from "@/api/announcements";
import events from "@/api/events";
import shifts from "@/api/shifts";
import media from "@/api/media";
import organizationConfig from "@/api/organizationConfig";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export const app = new Hono()
  .basePath("/api")
  .use("*", logger())
  .use("*", cors())
  .route("/ping", ping)
  .route("/joinRequests", joinRequests)
  .route("/announcements", announcements)
  .route("/events", events)
  .route("/organizationConfig", organizationConfig)
  .route("/shifts", shifts)
  .route("/media", media);

export type AppType = typeof app;
