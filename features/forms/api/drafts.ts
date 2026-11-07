import { Hono } from "hono";
import { requireMembership } from "@/core/auth/authUtils";
import { assertFeatureEnabled } from "@/core/auth/featureGuards";
import { OrganizationConfigKey } from "@/core/config/schema";

// A member's saved answers for a form (#338): GET, PUT, and DELETE
// /api/forms/:formId/draft. Add routes to this chain; the guard covers them.
const app = new Hono<{
  Variables: { organizationId: string; userId: string };
}>().use("/:formId/draft", async (c, next) => {
  const session = await requireMembership(c);
  const organizationId = session.session.activeOrganizationId!;
  await assertFeatureEnabled(
    organizationId,
    OrganizationConfigKey.FormsEnabled,
  );
  c.set("organizationId", organizationId);
  c.set("userId", session.user.id);
  await next();
});

export default app;
