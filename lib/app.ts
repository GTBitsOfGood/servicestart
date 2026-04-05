import ping from "@/api/ping";
import joinRequests from "@/api/joinRequests";
import announcements from "@/api/announcements";
import events from "@/api/events";
import shifts from "@/api/shifts";
import media from "@/api/media";
import organizationConfig from "@/api/organizationConfig";
import members from "@/api/members";
import messages from "@/api/messages";
import profile from "@/api/profile";
import { Hono } from "hono";
import notifications from "@/api/notifications";

export const app = new Hono()
  .basePath("/api")
  .route("/ping", ping)
  .route("/joinRequests", joinRequests)
  .route("/announcements", announcements)
  .route("/events", events)
  .route("/organizationConfig", organizationConfig)
  .route("/shifts", shifts)
  .route("/media", media)
  .route("/notifications", notifications)
  .route("/members", members)
  .route("/messages", messages)
  .route("/profile", profile);

export type AppType = typeof app;
