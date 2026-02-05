import { JOIN_REQUEST_STATUS_VALUES, JoinRequestStatus } from "@/lib/schema";
import { Hono } from "hono";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { JoinRequestsService } from "@/lib/services/joinRequests";
import { MembersService } from "@/lib/services/members";
import { auth } from "@/lib/auth";

const getParamsSchema = z.object({
  page: z
    .string()
    .or(z.number()) // Number inputs get converted to strings by Hono
    .optional()
    .transform((val) => {
      const num = parseInt(String(val) || "1");
      return isNaN(num) ? 1 : num;
    })
    .pipe(z.number().int().min(1, "Page must be at least 1")),
  pageSize: z
    .string()
    .or(z.number())
    .optional()
    .transform((val) => {
      const num = parseInt(String(val) || "20");
      return isNaN(num) ? 20 : num;
    })
    .pipe(
      z
        .number()
        .int()
        .min(1, "Page size must be at least 1")
        .max(100, "Page size must be at most 100"),
    ),
});

// Schema for PATCH parameters
const patchParamsSchema = z.object({
  id: z.string({ error: "Missing required parameter: id" }).min(1),
  status: z.enum(JOIN_REQUEST_STATUS_VALUES, {
    error: "Invalid status. Must be pending, approved, or denied",
  }),
});

const app = new Hono()
  .get("/", zValidator("query", getParamsSchema), async (c) => {
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

    const { page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    // Query join requests for the organization
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

    // Find the join request
    const joinRequest = await JoinRequestsService.findByIdAndOrganization(
      joinRequestId,
      activeOrganizationId,
    );

    if (!joinRequest) {
      return c.json({ error: "Join request not found" }, { status: 404 });
    }

    // If already approved, don't change anything
    if (joinRequest.status === JoinRequestStatus.Approved) {
      return c.json({
        message: "Join request is already approved",
        joinRequest,
      });
    }

    // Update the status
    const updatedRequest = await JoinRequestsService.updateStatus(
      joinRequestId,
      newStatus as JoinRequestStatus,
    );

    // If new status is approved, add the user to the organization
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
  });

export default app;
