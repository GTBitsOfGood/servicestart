import { JOIN_REQUEST_STATUS_VALUES, JoinRequestStatus } from "@/lib/schema";
import { Hono } from "hono";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { JoinRequestsService } from "@/lib/services/joinRequests";
import { MembersService } from "@/lib/services/members";
import { auth } from "@/lib/auth";
import { paginationQuerySchema } from "../lib/apiUtils";

const patchParamsSchema = z.object({
  id: z.string({ error: "Missing required parameter: id" }).min(1),
  status: z.enum(JOIN_REQUEST_STATUS_VALUES, {
    error: "Invalid status. Must be pending, approved, or denied",
  }),
});

const app = new Hono()
  .get("/", zValidator("query", paginationQuerySchema), async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeOrganizationId = session.session.activeOrganizationId;

    if (!activeOrganizationId) {
      return c.json({ error: "No active organization" }, { status: 400 });
    }

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
    );

    if (!MembersService.isAdminOrOwner(membership?.role)) {
      return c.json(
        { error: "Forbidden: Admin or owner role required" },
        { status: 403 },
      );
    }

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
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeOrganizationId = session.session.activeOrganizationId;

    if (!activeOrganizationId) {
      return c.json({ error: "No active organization" }, { status: 400 });
    }

    // Check if user is admin or owner of the active organization
    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
    );

    if (!MembersService.isAdminOrOwner(membership?.role)) {
      return c.json(
        { error: "Forbidden: Admin or owner role required" },
        { status: 403 },
      );
    }

    const { id: joinRequestId, status: newStatus } = c.req.valid("query");

    const joinRequest = await JoinRequestsService.findByIdAndOrganization(
      joinRequestId,
      activeOrganizationId,
    );

    if (!joinRequest) {
      return c.json({ error: "Join request not found" }, { status: 404 });
    }

    if (joinRequest.status === JoinRequestStatus.Approved) {
      return c.json({
        message: "Join request is already approved",
        joinRequest,
      });
    }

    const updatedRequest = await JoinRequestsService.updateStatus(
      joinRequestId,
      newStatus as JoinRequestStatus,
    );

    if (newStatus === JoinRequestStatus.Approved) {
      await auth.api.addMember({
        body: {
          organizationId: activeOrganizationId,
          userId: joinRequest.userId,
          role: "member",
        },
      });
    }

    return c.json(updatedRequest);
  })
  .get("/:organizationId", async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = c.req.param();

    const joinRequest = await JoinRequestsService.findByUserAndOrganization(
      session.user.id,
      organizationId,
    );

    if (!joinRequest) {
      return c.json({ error: "Join request not found" }, { status: 404 });
    }

    return c.json(joinRequest);
  })
  .delete("/:organizationId", async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = c.req.param();

    const joinRequest = await JoinRequestsService.findByUserAndOrganization(
      session.user.id,
      organizationId,
    );

    if (!joinRequest) {
      return c.json({ error: "Join request not found" }, { status: 404 });
    }

    if (joinRequest.status !== JoinRequestStatus.Pending) {
      return c.json(
        { error: "Cannot delete a non-pending join request" },
        { status: 403 },
      );
    }

    await JoinRequestsService.deleteById(joinRequest.id);

    return c.json({ success: true });
  });

export default app;
