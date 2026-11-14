import { createMiddleware } from "hono/factory";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  handleFormsError,
  requireFormsAdmin,
} from "@/features/forms/api/adminRoutes";
import { SaveQuestionsSchema } from "@/features/forms/lib/management";
import { FormIdSchema } from "@/features/forms/lib/schema";
import { FormQuestionService } from "@/features/forms/services/FormQuestionService";

// The question builder API.
const formParam = z.object({ formId: FormIdSchema });
const requireQuestionAdmin = createMiddleware<{
  Variables: { organizationId: string };
}>(async (c, next) => {
  const { organizationId } = await requireFormsAdmin(c);
  c.set("organizationId", organizationId);
  await next();
});
const app = new Hono<{ Variables: { organizationId: string } }>()
  .onError(handleFormsError)
  .get(
    "/:formId/questions",
    requireQuestionAdmin,
    zValidator("param", formParam),
    async (c) =>
      c.json(
        await FormQuestionService.get(
          c.get("organizationId"),
          c.req.valid("param").formId,
        ),
      ),
  )
  .put(
    "/:formId/questions",
    requireQuestionAdmin,
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
