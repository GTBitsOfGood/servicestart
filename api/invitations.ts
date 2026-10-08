import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { requireAuth } from "@/lib/authUtils";
import { findOrganizationByRequestHost } from "@/lib/organizationFromHost";
import { InvitationService } from "@/lib/services/InvitationService";

const paramsSchema = z.object({ id: z.string().min(1) });

const app = new Hono().post(
  "/:id/accept",
  zValidator("param", paramsSchema),
  async (c) => {
    const session = await requireAuth(c);
    const { id } = c.req.valid("param");

    const organization = await findOrganizationByRequestHost(
      c.req.header("host"),
    );
    if (!organization) {
      throw new HTTPException(404, { message: "Organization not found" });
    }

    const role = await InvitationService.acceptForUser(
      id,
      organization.id,
      session.user,
    );
    if (!role) {
      throw new HTTPException(400, {
        message: "Unable to accept this invitation",
      });
    }

    return c.json({ organizationId: organization.id });
  },
);

export default app;
