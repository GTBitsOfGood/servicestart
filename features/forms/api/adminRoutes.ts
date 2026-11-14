import type { Context } from "hono";
import { z } from "zod";
import { requireAdmin } from "@/core/auth/authUtils";
import { FormError } from "@/features/forms/lib/management";
import { OrganizationConfigKey } from "@/core/config/schema";
import { assertFeatureEnabled } from "@/core/auth/featureGuards";
import { handleError } from "@/core/api/handleError";

/*
 * Shared by the forms admin sub-apps (forms.ts and formQuestions.ts).
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
  if (error instanceof z.ZodError)
    return c.json({ error: "Invalid request", issues: error.issues }, 400);
  return handleError(error, c);
}

/** Requires an admin of the active org, with forms on (404 when they're off). */
export async function requireFormsAdmin(c: Context) {
  const session = await requireAdmin(c);
  const organizationId = session.session.activeOrganizationId!;
  await assertFeatureEnabled(
    organizationId,
    OrganizationConfigKey.FormsEnabled,
  );
  return { organizationId, userId: session.user.id };
}
