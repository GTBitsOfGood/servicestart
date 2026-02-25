import ping from "@/api/ping";
import joinRequests from "@/api/joinRequests";
import announcements from "@/api/announcements";
import events from "@/api/events";
import shifts from "@/api/shifts";
import media from "@/api/media";
import organizationConfig from "@/api/organizationConfig";
import { Hono } from "hono";
import { cors } from "hono/cors";

export const app = new Hono()
  .use(
    "/api/*",
    cors({
      origin: process.env.NEXT_PUBLIC_BASE_URL
        ? [
            process.env.NEXT_PUBLIC_BASE_URL,
            process.env.NEXT_PUBLIC_ADDITIONAL_ALLOWED_ORIGIN,
          ].filter((url) => url !== undefined)
        : "http://localhost:3000",
    }),
  )
  .basePath("/api")
  .route("/ping", ping)
  .route("/joinRequests", joinRequests)
  .route("/announcements", announcements)
  .route("/events", events)
  .route("/organizationConfig", organizationConfig)
  .route("/shifts", shifts)
  .route("/media", media);

export type AppType = typeof app;
