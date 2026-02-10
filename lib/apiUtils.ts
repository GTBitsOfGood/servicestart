import { z } from "zod";

export const paginationQuerySchema = z.object({
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
