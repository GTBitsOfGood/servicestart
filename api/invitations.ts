import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { requireAuth } from "@/lib/authUtils";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import {
  AcceptInvitationResult,
  InvitationService,
} from "@/lib/services/InvitationService";
import { OrganizationsService } from "@/lib/services/OrganizationService";

const paramsSchema = z.object({ id: z.string().min(1) });

/** Status and message for each way accepting can fail. */
const ACCEPT_FAILURE = {
  [AcceptInvitationResult.NotFound]: {
    status: 404,
    message: "Invitation not found",
  },
  [AcceptInvitationResult.Closed]: {
    status: 410,
    message: "This invitation has expired or was already used",
  },
  [AcceptInvitationResult.WrongRecipient]: {
    status: 403,
    message: "This invitation is for a different email",
  },
  [AcceptInvitationResult.AlreadyMember]: {
    status: 409,
    message: "You're already a member of this organization",
  },
} as const satisfies Record<
  Exclude<AcceptInvitationResult, typeof AcceptInvitationResult.Accepted>,
  { status: 403 | 404 | 409 | 410; message: string }
>;

const app = new Hono().post(
  "/:id/accept",
  zValidator("param", paramsSchema),
  async (c) => {
    const session = await requireAuth(c);
    const { id } = c.req.valid("param");

    // The invitation must belong to the org on this host, not whichever org
    // happens to be active on the session.
    const organization = await OrganizationsService.findBySlug(
      getSlugFromHost(c.req.header("host")),
    );
    if (!organization) {
      throw new HTTPException(404, { message: "Organization not found" });
    }

    const result = await InvitationService.acceptForUser(
      id,
      organization.id,
      session.user,
    );
    if (result !== AcceptInvitationResult.Accepted) {
      const { status, message } = ACCEPT_FAILURE[result];
      throw new HTTPException(status, { message });
    }

    return c.json({ organizationId: organization.id });
  },
);

export default app;
