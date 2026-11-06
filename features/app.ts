import ping from "@/core/api/ping";
import forms from "@/features/forms/api/forms";
import joinRequests from "@/features/membership/api/joinRequests";
import announcements from "@/features/communications/api/announcements";
import events from "@/features/events/api/events";
import shifts from "@/features/events/api/shifts";
import media from "@/features/media/api/media";
import organizationConfig from "@/core/config/api/organizationConfig";
import members from "@/features/membership/api/members";
import messages from "@/features/communications/api/messages";
import profile from "@/features/membership/api/profile";
import tags from "@/features/events/api/tags";
import formSubmissions from "@/features/forms/api/formSubmissions";
import formQuestions from "@/features/forms/api/formQuestions";
import formResponses from "@/features/forms/api/formResponses";
import informationRequests from "@/features/forms/api/informationRequests";
import alerts from "@/features/communications/api/alerts";
import invitations from "@/features/membership/api/invitations";
import { Hono } from "hono";
import notifications from "@/features/communications/api/notifications";
import emails from "@/features/communications/api/emails";

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
  .route("/emails", emails)
  .route("/profile", profile)
  .route("/tags", tags)
  // api/forms.ts runs admin-only middleware for every /api/forms/* route
  // mounted after it, so mount other /forms sub-apps before it.
  .route("/forms", formQuestions)
  .route("/forms", formSubmissions)
  .route("/forms", forms)
  .route("/formResponses", formResponses)
  .route("/informationRequests", informationRequests)
  .route("/alerts", alerts)
  .route("/invitations", invitations);

export type AppType = typeof app;
