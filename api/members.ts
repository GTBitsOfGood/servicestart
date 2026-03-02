import { Hono } from "hono";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import db from "@/lib/db";
import { events, eventRsvps, shifts, shiftRSVPs } from "@/lib/schema";
import { requireAdmin } from "@/lib/authUtils";
import { MembersService } from "@/lib/services/MemberService";
import { paginationQuerySchema } from "@/lib/apiUtils";

const activityQuerySchema = z.object({
  userIds: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val])),
});

const app = new Hono()
  .get("/activity", zValidator("query", activityQuerySchema), async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;

    const { userIds } = c.req.valid("query");
    if (userIds.length === 0) {
      return c.json({ error: "userIds must not be empty" }, 400);
    }

    const now = new Date();

    const [eventActivity, shiftActivity] = await Promise.all([
      db
        .select({
          userId: eventRsvps.userId,
          totalSeconds: sql<number>`COALESCE(EXTRACT(EPOCH FROM SUM(${events.duration})), 0)`,
          lastActive: sql<Date | null>`MAX(${events.startTimestamp})`,
        })
        .from(eventRsvps)
        .innerJoin(events, eq(events.id, eventRsvps.eventId))
        .where(
          and(
            inArray(eventRsvps.userId, userIds),
            eq(events.organizationId, organizationId),
            isNotNull(events.startTimestamp),
            lt(events.startTimestamp, now),
            isNotNull(events.duration),
          ),
        )
        .groupBy(eventRsvps.userId),

      db
        .select({
          userId: shiftRSVPs.userId,
          totalSeconds: sql<number>`COALESCE(EXTRACT(EPOCH FROM SUM(${shifts.duration})), 0)`,
          lastActive: sql<Date | null>`MAX(${shifts.startTimestamp})`,
        })
        .from(shiftRSVPs)
        .innerJoin(shifts, eq(shifts.id, shiftRSVPs.shiftId))
        .where(
          and(
            inArray(shiftRSVPs.userId, userIds),
            eq(shifts.organizationId, organizationId),
            lt(shifts.startTimestamp, now),
          ),
        )
        .groupBy(shiftRSVPs.userId),
    ]);

    const activityMap = new Map<
      string,
      { totalSeconds: number; lastActive: Date | null }
    >();

    for (const row of eventActivity) {
      activityMap.set(row.userId, {
        totalSeconds: Number(row.totalSeconds),
        lastActive: row.lastActive,
      });
    }

    for (const row of shiftActivity) {
      const existing = activityMap.get(row.userId);
      const shiftSeconds = Number(row.totalSeconds);
      const shiftLastActive = row.lastActive;

      if (!existing) {
        activityMap.set(row.userId, {
          totalSeconds: shiftSeconds,
          lastActive: shiftLastActive,
        });
      } else {
        const mergedLastActive =
          existing.lastActive == null
            ? shiftLastActive
            : shiftLastActive == null
              ? existing.lastActive
              : existing.lastActive > shiftLastActive
                ? existing.lastActive
                : shiftLastActive;

        activityMap.set(row.userId, {
          totalSeconds: existing.totalSeconds + shiftSeconds,
          lastActive: mergedLastActive,
        });
      }
    }

    const result: Record<
      string,
      { totalHours: number; lastActive: string | null }
    > = {};

    for (const userId of userIds) {
      const entry = activityMap.get(userId);
      result[userId] = {
        totalHours: entry
          ? Math.round((entry.totalSeconds / 3600) * 10) / 10
          : 0,
        lastActive: entry?.lastActive
          ? new Date(entry.lastActive).toISOString()
          : null,
      };
    }

    return c.json(result);
  })
  .get("/", zValidator("query", paginationQuerySchema), async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;

    const { page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      MembersService.listMembers(organizationId, { limit: pageSize, offset }),
      MembersService.countByOrganization(organizationId),
    ]);

    return c.json({ data, total, page, pageSize });
  });

export default app;
