import { getSlugFromHost } from "@/core/tenant/host";
import { resolveOrganization } from "@/core/tenant/resolveOrganization";
import { ForbiddenError, NotFoundError } from "@/core/api/errors";
import { requireAuth, requireAdmin } from "@/core/auth/authUtils";
import {
  JOIN_REQUEST_STATUS_VALUES,
  JoinRequestStatus,
} from "@/features/membership/schema";
import { Hono } from "hono";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { JoinRequestsService } from "@/features/membership/services/JoinRequestService";
import { paginationQuerySchema } from "@/core/api/apiUtils";

const patchParamsSchema = z.object({
  id: z.string({ error: "Missing required parameter: id" }).min(1),
  status: z.enum(JOIN_REQUEST_STATUS_VALUES, {
    error: "Invalid status. Must be pending, approved, or denied",
  }),
  denialReason: z.string().optional(),
});

const app = new Hono()
  .get("/", zValidator("query", paginationQuerySchema), async (c) => {
    const session = await requireAdmin(
      c,
      "Forbidden: Admin or owner role required",
    );
    const activeOrganizationId = session.session.activeOrganizationId!;

    const { page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    const requests = await JoinRequestsService.listByOrganization(
      activeOrganizationId,
      { limit: pageSize, offset },
    );

    return c.json({
      data: requests,
      page,
      pageSize,
    });
  })
  .patch("/", zValidator("query", patchParamsSchema), async (c) => {
    const session = await requireAdmin(
      c,
      "Forbidden: Admin or owner role required",
    );
    const activeOrganizationId = session.session.activeOrganizationId!;

    const {
      id: joinRequestId,
      status: newStatus,
      denialReason,
    } = c.req.valid("query");

    const joinRequest = await JoinRequestsService.findByIdAndOrganization(
      joinRequestId,
      activeOrganizationId,
    );

    if (!joinRequest) {
      throw new NotFoundError("Join request not found");
    }

    if (
      joinRequest.status === JoinRequestStatus.Approved &&
      newStatus !== JoinRequestStatus.Pending
    ) {
      return c.json({
        message: "Join request is already approved",
        joinRequest,
      });
    }

    const updatedRequest = await JoinRequestsService.updateStatus(
      joinRequestId,
      newStatus as JoinRequestStatus,
      session.user.id,
      c.req.raw.headers,
      denialReason,
      joinRequest.status as JoinRequestStatus,
    );

    return c.json({ success: true, joinRequest: updatedRequest });
  })
  .get("/:organizationId", async (c) => {
    const session = await requireAuth(c);

    const { organizationId } = c.req.param();
    const organization = await resolveOrganization(c, session);
    if (
      (organization || getSlugFromHost(c.req.header("host"))) &&
      organization?.id !== organizationId
    )
      throw new NotFoundError("Join request not found");

    const joinRequest = await JoinRequestsService.findByUserAndOrganization(
      session.user.id,
      organizationId,
    );

    if (!joinRequest) {
      throw new NotFoundError("Join request not found");
    }

    return c.json(joinRequest);
  })
  .delete("/:organizationId", async (c) => {
    const session = await requireAuth(c);

    const { organizationId } = c.req.param();
    const organization = await resolveOrganization(c, session);
    if (
      (organization || getSlugFromHost(c.req.header("host"))) &&
      organization?.id !== organizationId
    )
      throw new NotFoundError("Join request not found");

    const joinRequest = await JoinRequestsService.findByUserAndOrganization(
      session.user.id,
      organizationId,
    );

    if (!joinRequest) {
      throw new NotFoundError("Join request not found");
    }

    if (joinRequest.status !== JoinRequestStatus.Pending) {
      throw new ForbiddenError("Cannot delete a non-pending join request");
    }

    // Removing a member moves their request back to pending. That row is the
    // removal record, so withdrawing it would let AutoApproveSignups re-add them.
    const history = await JoinRequestsService.listHistory(joinRequest.id);
    if (history.some((entry) => entry.action === "removed")) {
      throw new ForbiddenError("Cannot delete a join request after removal");
    }

    await JoinRequestsService.deleteById(joinRequest.id);

    return c.json({ success: true });
  });

export default app;
