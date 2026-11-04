import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAdmin } from "@/lib/authUtils";
import { FormError } from "@/lib/forms/management";
import { OrganizationConfigKey } from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

/*
 * Shared by the forms admin sub-apps (api/forms.ts and api/formQuestions.ts).
 * Server only.
 */

/** The `onError` handler: FormErrors and validation errors become 4xx. */
export function handleFormsError(error: Error, c: Context) {
  if (error instanceof FormError)
    return c.json(
      { error: error.message, field: error.field },
      error.reason === "not-found"
        ? 404
        : error.reason === "conflict"
          ? 409
          : 400,
    );
  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return c.json({ error: "Invalid request", issues: error.issues }, 400);
  console.error(error);
  return c.json({ error: "Unable to complete the form request" }, 500);
}

/** Requires an admin of the active org, with forms on (404 when they're off). */
export async function requireFormsAdmin(c: Context) {
  const session = await requireAdmin(c);
  const organizationId = session.session.activeOrganizationId!;
  const config = await OrganizationConfigService.getConfig(organizationId, [
    OrganizationConfigKey.FormsEnabled,
  ]);
  if (!config[OrganizationConfigKey.FormsEnabled])
    throw new HTTPException(404, { message: "Not found" });
  return { organizationId, userId: session.user.id };
}
