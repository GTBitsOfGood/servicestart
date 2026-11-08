import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "@/core/auth/authUtils";
import { assertFeatureEnabled } from "@/core/auth/featureGuards";
import { ForbiddenError, NotFoundError } from "@/core/api/errors";
import { OrganizationConfigKey } from "@/core/config/schema";
import { findOrganizationByRequestHost } from "@/core/tenant/organizationFromHost";
import {
  FormIdSchema,
  FormSubmissionPayloadSchema,
  buildDraftSchema,
} from "@/features/forms/lib/schema";
import {
  getAnswerErrors,
  getFormAvailability,
} from "@/features/forms/lib/submission";
import { FormDraftService } from "@/features/forms/services/FormDraftService";
import { FormSubmissionService } from "@/features/forms/services/FormSubmissionService";
import { MembersService } from "@/features/membership/server";

// A member's saved answers for a form (#338): GET, PUT, and DELETE
// /api/forms/:formId/draft. Mounted at /api/forms before forms.ts (in
// features/app.ts already), so that sub-app's admin middleware doesn't run
// here.
const FORM_NOT_FOUND = "Form not found";
const DRAFT_NOT_FOUND = "Draft not found";
const formParam = z.object({ formId: FormIdSchema });

const app = new Hono<{
  Variables: { organizationId: string; userId: string };
}>()
  .use("/:formId/draft", async (c, next) => {
    const session = await requireAuth(c);
    const organization = await findOrganizationByRequestHost(
      c.req.header("host"),
    );
    if (!organization) throw new NotFoundError();

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      organization.id,
    );
    // Don't reveal whether a host organization or one of its forms exists.
    if (!membership) throw new NotFoundError();

    const organizationId = organization.id;
    await assertFeatureEnabled(
      organizationId,
      OrganizationConfigKey.FormsEnabled,
    );
    c.set("organizationId", organizationId);
    c.set("userId", session.user.id);
    await next();
  })
  .get(
    "/:formId/draft",
    zValidator("param", formParam, (result, c) => {
      if (!result.success) return c.json({ error: DRAFT_NOT_FOUND }, 404);
    }),
    async (c) => {
      const draft = await FormDraftService.get(
        c.get("organizationId"),
        c.req.valid("param").formId,
        c.get("userId"),
      );
      if (!draft) return c.json({ error: DRAFT_NOT_FOUND }, 404);
      return c.json(draft);
    },
  )
  .put(
    "/:formId/draft",
    zValidator("param", formParam, (result, c) => {
      if (!result.success) return c.json({ error: FORM_NOT_FOUND }, 404);
    }),
    zValidator("json", FormSubmissionPayloadSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: "Answers are in the wrong format", fieldErrors: {} },
          400,
        );
      }
    }),
    async (c) => {
      const organizationId = c.get("organizationId");
      const formId = c.req.valid("param").formId;
      const form = await FormSubmissionService.getPublishedDefinition(
        organizationId,
        formId,
      );
      if (!form) return c.json({ error: FORM_NOT_FOUND }, 404);
      if (getFormAvailability(form) !== "open") {
        throw new ForbiddenError("This form isn't accepting responses");
      }

      const parsed = buildDraftSchema(form).safeParse(
        c.req.valid("json").answers,
      );
      if (!parsed.success) {
        return c.json(
          {
            error: "Some answers couldn't be saved",
            fieldErrors: getAnswerErrors(parsed.error),
          },
          400,
        );
      }

      const draft = await FormDraftService.save({
        organizationId,
        formId,
        userId: c.get("userId"),
        answers: parsed.data,
      });
      if (!draft) return c.json({ error: FORM_NOT_FOUND }, 404);
      return c.json(draft);
    },
  )
  .delete(
    "/:formId/draft",
    zValidator("param", formParam, (result, c) => {
      if (!result.success) return c.json({ error: DRAFT_NOT_FOUND }, 404);
    }),
    async (c) => {
      const deleted = await FormDraftService.delete(
        c.get("organizationId"),
        c.req.valid("param").formId,
        c.get("userId"),
      );
      if (!deleted) return c.json({ error: DRAFT_NOT_FOUND }, 404);
      return c.json({ success: true });
    },
  );

export default app;
