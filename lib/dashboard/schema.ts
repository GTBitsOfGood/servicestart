import { z } from "zod";

export const WIDGET_IDS = [
  "events",
  "notifications",
  "member_requests",
  "newsletter",
] as const;

export const WIDGET_SIZES = ["tall", "small"] as const;

export const LAYOUT_DIRECTIONS = ["vertical", "horizontal"] as const;

export const WidgetIdSchema = z.enum(WIDGET_IDS);

export const WidgetSizeSchema = z.enum(WIDGET_SIZES);

export const DashboardWidgetSchema = z.object({
  id: WidgetIdSchema,
  size: WidgetSizeSchema,
});

export const DashboardLayoutSchema = z
  .object({
    layout: z.enum(LAYOUT_DIRECTIONS),
    widgets: z.array(DashboardWidgetSchema).max(4),
  })
  .refine(
    (data) => {
      const ids = data.widgets.map((w) => w.id);
      return new Set(ids).size === ids.length;
    },
    { message: "Duplicate widget IDs are not allowed" },
  );

export type WidgetId = z.infer<typeof WidgetIdSchema>;
export type WidgetSize = z.infer<typeof WidgetSizeSchema>;
export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;
export type DashboardLayout = z.infer<typeof DashboardLayoutSchema>;
