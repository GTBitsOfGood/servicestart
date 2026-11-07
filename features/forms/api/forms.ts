import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  handleFormsError,
  requireFormsAdmin,
} from "@/features/forms/api/adminRoutes";
import { FormIdSchema } from "@/features/forms/lib/schema";
import {
  CreateFormSchema,
  UpdateFormSchema,
  FormError,
} from "@/features/forms/lib/management";
import { FormService } from "@/features/forms/services/FormService";
import { FileService } from "@/core/files/FileService";

const formParam = z.object({ formId: FormIdSchema });
const requireAdminForRoute = createMiddleware<{
  Variables: { organizationId: string; userId: string };
}>(async (c, next) => {
  let admin;
  try {
    admin = await requireFormsAdmin(c);
  } catch (error) {
    // Headshots must never disclose whether a private file exists.
    if (c.req.path.includes("/uploads/") && error instanceof HTTPException)
      throw new HTTPException(404, { message: "File not found" });
    throw error;
  }
  c.set("organizationId", admin.organizationId);
  c.set("userId", admin.userId);
  await next();
});
const app = new Hono<{
  Variables: { organizationId: string; userId: string };
}>()
  .onError(handleFormsError)
  .get("/", requireAdminForRoute, async (c) =>
    c.json(await FormService.list(c.get("organizationId"))),
  )
  .post(
    "/",
    requireAdminForRoute,
    zValidator("json", CreateFormSchema),
    async (c) =>
      c.json(
        await FormService.create(
          c.get("organizationId"),
          c.get("userId"),
          c.req.valid("json"),
        ),
        201,
      ),
  )
  .get(
    "/:formId",
    requireAdminForRoute,
    zValidator("param", formParam),
    async (c) =>
      c.json(
        await FormService.get(
          c.get("organizationId"),
          c.req.valid("param").formId,
        ),
      ),
  )
  .patch(
    "/:formId",
    requireAdminForRoute,
    zValidator("param", formParam),
    zValidator("json", UpdateFormSchema),
    async (c) =>
      c.json(
        await FormService.update(
          c.get("organizationId"),
          c.req.valid("param").formId,
          c.req.valid("json"),
        ),
      ),
  )
  .delete(
    "/:formId",
    requireAdminForRoute,
    zValidator("param", formParam),
    async (c) => {
      await FormService.remove(
        c.get("organizationId"),
        c.req.valid("param").formId,
      );
      return c.json({ success: true });
    },
  )
  .post(
    "/:formId/publish",
    requireAdminForRoute,
    zValidator("param", formParam),
    async (c) =>
      c.json(
        await FormService.transition(
          c.get("organizationId"),
          c.req.valid("param").formId,
          "publish",
        ),
      ),
  )
  .post(
    "/:formId/close",
    requireAdminForRoute,
    zValidator("param", formParam),
    async (c) =>
      c.json(
        await FormService.transition(
          c.get("organizationId"),
          c.req.valid("param").formId,
          "close",
        ),
      ),
  )
  .post(
    "/:formId/reopen",
    requireAdminForRoute,
    zValidator("param", formParam),
    async (c) =>
      c.json(
        await FormService.transition(
          c.get("organizationId"),
          c.req.valid("param").formId,
          "reopen",
        ),
      ),
  )
  .get(
    "/:formId/export.csv",
    requireAdminForRoute,
    zValidator("param", formParam),
    async (c) => {
      const { formId } = c.req.valid("param");
      const csv = await FormService.exportCsv(
        c.get("organizationId"),
        formId,
        new URL(c.req.url).origin,
      );
      return c.body(csv, 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${formId}.csv"`,
        "Cache-Control": "private, no-store",
      });
    },
  )
  .get(
    "/:formId/uploads/:uploadId",
    requireAdminForRoute,
    zValidator("param", formParam.extend({ uploadId: z.uuid() })),
    async (c) => {
      const { formId, uploadId } = c.req.valid("param");
      const upload = await FormService.getUpload(
        c.get("organizationId"),
        formId,
        uploadId,
      );
      try {
        const buffer = await FileService.readFile(
          c.get("organizationId"),
          upload.fileName,
        );
        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type": upload.contentType,
            "Content-Length": String(buffer.length),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        )
          throw new FormError("not-found", "File not found");
        throw error;
      }
    },
  );

export default app;
