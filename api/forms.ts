import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin } from "@/lib/authUtils";
import { OrganizationConfigKey } from "@/lib/schema";
import { FormIdSchema } from "@/lib/forms/schema";
import {
  CreateFormSchema,
  UpdateFormSchema,
  FormError,
} from "@/lib/forms/management";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { FormService } from "@/lib/services/FormService";
import { FileService } from "@/lib/services/FileService";

const formParam = z.object({ formId: FormIdSchema });
const app = new Hono<{
  Variables: { organizationId: string; userId: string };
}>()
  .onError((error, c) => {
    if (error instanceof FormError)
      return c.json(
        { error: error.message, field: error.field },
        error.reason === "not-found"
          ? 404
          : error.reason === "conflict"
            ? 409
            : 400,
      );
    if (error instanceof HTTPException)
      return c.json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return c.json({ error: "Invalid request", issues: error.issues }, 400);
    console.error(error);
    return c.json({ error: "Unable to complete the form request" }, 500);
  })
  .use("*", async (c, next) => {
    let session;
    try {
      session = await requireAdmin(c);
    } catch (error) {
      // Headshots must never disclose whether a private file exists.
      if (c.req.path.includes("/uploads/") && error instanceof HTTPException)
        throw new HTTPException(404, { message: "File not found" });
      throw error;
    }
    const organizationId = session.session.activeOrganizationId!;
    const config = await OrganizationConfigService.getConfig(organizationId, [
      OrganizationConfigKey.FormsEnabled,
    ]);
    if (!config[OrganizationConfigKey.FormsEnabled])
      throw new HTTPException(404, { message: "Not found" });
    c.set("organizationId", organizationId);
    c.set("userId", session.user.id);
    await next();
  })
  .get("/", async (c) =>
    c.json(await FormService.list(c.get("organizationId"))),
  )
  .post("/", zValidator("json", CreateFormSchema), async (c) =>
    c.json(
      await FormService.create(
        c.get("organizationId"),
        c.get("userId"),
        c.req.valid("json"),
      ),
      201,
    ),
  )
  .get("/:formId", zValidator("param", formParam), async (c) =>
    c.json(
      await FormService.get(
        c.get("organizationId"),
        c.req.valid("param").formId,
      ),
    ),
  )
  .patch(
    "/:formId",
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
  .delete("/:formId", zValidator("param", formParam), async (c) => {
    await FormService.remove(
      c.get("organizationId"),
      c.req.valid("param").formId,
    );
    return c.json({ success: true });
  })
  .post("/:formId/publish", zValidator("param", formParam), async (c) =>
    c.json(
      await FormService.transition(
        c.get("organizationId"),
        c.req.valid("param").formId,
        "publish",
      ),
    ),
  )
  .post("/:formId/close", zValidator("param", formParam), async (c) =>
    c.json(
      await FormService.transition(
        c.get("organizationId"),
        c.req.valid("param").formId,
        "close",
      ),
    ),
  )
  .post("/:formId/reopen", zValidator("param", formParam), async (c) =>
    c.json(
      await FormService.transition(
        c.get("organizationId"),
        c.req.valid("param").formId,
        "reopen",
      ),
    ),
  )
  .get("/:formId/export.csv", zValidator("param", formParam), async (c) => {
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
  })
  .get(
    "/:formId/uploads/:uploadId",
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
