import { handleError } from "@/core/api/handleError";
import { Hono } from "hono";
import ping from "@/core/api/ping";
import organizationConfig from "@/core/config/api/organizationConfig";
import alerts from "@/features/communications/api/alerts";
import announcements from "@/features/communications/api/announcements";
import emails from "@/features/communications/api/emails";
import messages from "@/features/communications/api/messages";
import notifications from "@/features/communications/api/notifications";
import events from "@/features/events/api/events";
import shifts from "@/features/events/api/shifts";
import tags from "@/features/events/api/tags";
import drafts from "@/features/forms/api/drafts";
import formQuestions from "@/features/forms/api/formQuestions";
import formResponses from "@/features/forms/api/formResponses";
import formSubmissions from "@/features/forms/api/formSubmissions";
import forms from "@/features/forms/api/forms";
import informationRequests from "@/features/forms/api/informationRequests";
import media from "@/features/media/api/media";
import invitations from "@/features/membership/api/invitations";
import joinRequests from "@/features/membership/api/joinRequests";
import members from "@/features/membership/api/members";
import memberTypes from "@/features/membership/api/memberTypes";
import profile from "@/features/membership/api/profile";

/*
 * The only Hono root: app/api/[[...route]]/route.ts serves it, the typed RPC
 * client (core/api/client.ts) and the tests call it. Keep the .route() chain
 * explicit, because the chain is what types the client. To add routes to a
 * pre-registered sub-app, edit that sub-app, not this file.
 */
export const app = new Hono()
  .basePath("/api")
  .onError(handleError)
  .route("/ping", ping)
  .route("/joinRequests", joinRequests)
  .route("/announcements", announcements)
  .route("/events", events)
  .route("/organizationConfig", organizationConfig)
  .route("/shifts", shifts)
  .route("/media", media)
  .route("/notifications", notifications)
  .route("/members", members)
  .route("/memberTypes", memberTypes)
  .route("/messages", messages)
  .route("/emails", emails)
  .route("/profile", profile)
  .route("/tags", tags)
  .route("/forms", formQuestions)
  .route("/forms", formSubmissions)
  .route("/forms", drafts)
  .route("/forms", forms)
  .route("/formResponses", formResponses)
  .route("/informationRequests", informationRequests)
  .route("/alerts", alerts)
  .route("/invitations", invitations);

export type AppType = typeof app;
