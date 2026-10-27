import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { handleFormsError, requireFormsAdmin } from "@/lib/forms/adminRoutes";
import { SaveQuestionsSchema } from "@/lib/forms/management";
import { FormIdSchema } from "@/lib/forms/schema";
import { FormQuestionService } from "@/lib/services/FormQuestionService";

// The question builder's API (#321). Mounted at /api/forms before
// api/forms.ts, so that sub-app's admin middleware doesn't run here.
const formParam = z.object({ formId: FormIdSchema });
const app = new Hono<{ Variables: { organizationId: string } }>()
  .onError(handleFormsError)
  .use("/:formId/questions", async (c, next) => {
    const { organizationId } = await requireFormsAdmin(c);
    c.set("organizationId", organizationId);
    await next();
  })
  .get("/:formId/questions", zValidator("param", formParam), async (c) =>
    c.json(
      await FormQuestionService.get(
        c.get("organizationId"),
        c.req.valid("param").formId,
      ),
    ),
  )
  .put(
    "/:formId/questions",
    zValidator("param", formParam),
    zValidator("json", SaveQuestionsSchema),
    async (c) =>
      c.json(
        await FormQuestionService.save(
          c.get("organizationId"),
          c.req.valid("param").formId,
          c.req.valid("json"),
        ),
      ),
  );

export default app;
