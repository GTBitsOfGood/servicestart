import { randomUUID } from "node:crypto";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { auth } from "@/lib/auth";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import {
  FORM_UPLOAD_CONTENT_TYPES,
  FORM_UPLOAD_MAX_BYTES,
  type FormUploadContentType,
} from "@/lib/forms/constants";
import { FormIdSchema, FormSubmissionPayloadSchema } from "@/lib/forms/schema";
import {
  buildSubmissionSchema,
  getAnswerErrors,
  getFormAvailability,
} from "@/lib/forms/submission";
import { FormComponentType, OrganizationConfigKey } from "@/lib/schema";
import { FileService } from "@/lib/services/FileService";
import {
  DuplicateSubmissionError,
  FormSubmissionService,
  InvalidUploadError,
} from "@/lib/services/FormSubmissionService";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { OrganizationsService } from "@/lib/services/OrganizationService";

const FORM_NOT_FOUND = "Form not found";
const TOO_LARGE = "Images must be 5 MB or smaller";
const WRONG_TYPE = "Upload a JPEG, PNG, or WebP image";
const ALREADY_SUBMITTED = "You've already responded to this form";

// Every 400 from the submit route has this shape, so the client's type does.
type AnswerErrors = Record<string, string>;

const paramSchema = z.object({ formId: FormIdSchema });

const uploadSchema = z.object({
  file: z
    .file({ error: "Choose an image to upload" })
    .max(FORM_UPLOAD_MAX_BYTES, TOO_LARGE)
    .mime([...FORM_UPLOAD_CONTENT_TYPES], WRONG_TYPE),
});

const FILE_EXTENSIONS: Record<FormUploadContentType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// Checks the file's bytes, since its declared type comes from the client.
async function matchesImageType(file: File, type: FormUploadContentType) {
  const bytes = Buffer.from(await file.slice(0, 12).arrayBuffer());
  const ascii = (start: number, end: number) =>
    bytes.toString("latin1", start, end);
  switch (type) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return (
        bytes[0] === 0x89 &&
        ascii(1, 4) === "PNG" &&
        ascii(4, 8) === "\r\n\x1a\n"
      );
    case "image/webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  }
}

// The host's org, or 404 when it doesn't exist or has forms turned off.
const requireFormsOrganization = createMiddleware<{
  Variables: { organizationId: string };
}>(async (c, next) => {
  const organization = await OrganizationsService.findBySlug(
    getSlugFromHost(c.req.header("host")),
  );
  if (!organization) throw new NotFoundError(FORM_NOT_FOUND);
  const config = await OrganizationConfigService.getConfig(organization.id, [
    OrganizationConfigKey.FormsEnabled,
  ]);
  if (!config[OrganizationConfigKey.FormsEnabled]) {
    throw new NotFoundError(FORM_NOT_FOUND);
  }
  c.set("organizationId", organization.id);
  await next();
});

// A published form that's taking responses.
async function getOpenForm(organizationId: string, formId: string) {
  const form = await FormSubmissionService.getPublishedDefinition(
    organizationId,
    formId,
  );
  if (!form) throw new NotFoundError(FORM_NOT_FOUND);
  if (getFormAvailability(form) !== "open") {
    throw new ForbiddenError("This form isn't accepting responses");
  }
  return form;
}

/**
 * The responding member's user ID, or null for anyone else, who can only
 * respond to forms that don't require login.
 */
async function getRespondentId(
  c: Context,
  organizationId: string,
  requireLogin: boolean,
) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const membership = session
    ? await MembersService.findByUserAndOrganization(
        session.user.id,
        organizationId,
      )
    : null;
  if (requireLogin && !session) throw new UnauthorizedError();
  if (requireLogin && !membership) {
    throw new ForbiddenError("Only members can respond to this form");
  }
  return session && membership ? session.user.id : null;
}

const app = new Hono()
  .post(
    "/:formId/submissions",
    zValidator("param", paramSchema, (result, c) => {
      if (!result.success) return c.json({ error: FORM_NOT_FOUND }, 404);
    }),
    requireFormsOrganization,
    zValidator("json", FormSubmissionPayloadSchema, (result, c) => {
      if (!result.success) {
        const fieldErrors: AnswerErrors = {};
        return c.json(
          { error: "Answers are in the wrong format", fieldErrors },
          400,
        );
      }
    }),
    async (c) => {
      const organizationId = c.get("organizationId");
      const form = await getOpenForm(
        organizationId,
        c.req.valid("param").formId,
      );
      const userId = await getRespondentId(
        c,
        organizationId,
        form.settings.requireLogin,
      );

      const parsed = buildSubmissionSchema(form).safeParse(
        c.req.valid("json").answers,
      );
      if (!parsed.success) {
        return c.json(
          {
            error: "Some answers need attention",
            fieldErrors: getAnswerErrors(parsed.error),
          },
          400,
        );
      }

      try {
        const id = await FormSubmissionService.submit({
          form,
          organizationId,
          userId,
          answers: parsed.data,
        });
        return c.json(
          { id, confirmationMessage: form.settings.confirmationMessage },
          201,
        );
      } catch (err) {
        if (err instanceof DuplicateSubmissionError) {
          return c.json({ error: ALREADY_SUBMITTED }, 409);
        }
        if (err instanceof InvalidUploadError) {
          const message = "Upload this image again";
          const fieldErrors: AnswerErrors = { [err.componentId]: message };
          return c.json({ error: message, fieldErrors }, 400);
        }
        throw err;
      }
    },
  )
  .post(
    "/:formId/uploads",
    zValidator("param", paramSchema, (result, c) => {
      if (!result.success) return c.json({ error: FORM_NOT_FOUND }, 404);
    }),
    requireFormsOrganization,
    // Stops reading oversized bodies early; the room is for multipart fields.
    bodyLimit({
      maxSize: FORM_UPLOAD_MAX_BYTES + 64 * 1024,
      onError: (c) => c.json({ error: TOO_LARGE }, 413),
    }),
    zValidator("form", uploadSchema, (result, c) => {
      if (!result.success) {
        const [issue] = result.error.issues;
        return c.json(
          { error: issue.message },
          issue.code === "too_big" ? 413 : 400,
        );
      }
    }),
    async (c) => {
      const organizationId = c.get("organizationId");
      const form = await getOpenForm(
        organizationId,
        c.req.valid("param").formId,
      );
      if (
        !form.components.some(({ type }) => type === FormComponentType.Image)
      ) {
        return c.json({ error: "This form doesn't take images" }, 400);
      }
      const userId = await getRespondentId(
        c,
        organizationId,
        form.settings.requireLogin,
      );
      if (
        userId &&
        !form.settings.allowMultipleSubmissions &&
        (await FormSubmissionService.hasSubmitted(form.id, userId))
      ) {
        return c.json({ error: ALREADY_SUBMITTED }, 409);
      }

      const { file } = c.req.valid("form");
      const contentType = file.type as FormUploadContentType;
      if (!(await matchesImageType(file, contentType))) {
        return c.json({ error: WRONG_TYPE }, 400);
      }

      // Headshots never get media rows, so they stay out of the media library.
      // The row goes in first so every stored file has one to clean up by.
      const fileName = `${randomUUID()}${FILE_EXTENSIONS[contentType]}`;
      const id = await FormSubmissionService.createUpload({
        organizationId,
        formId: form.id,
        uploadedBy: userId,
        fileName,
        contentType,
        sizeBytes: file.size,
      });
      try {
        await FileService.upload({ organizationId, fileName }, file);
      } catch {
        await FormSubmissionService.deleteUpload(id, organizationId);
        return c.json({ error: "Couldn't save the image. Try again." }, 500);
      }
      return c.json({ id }, 201);
    },
  );

export default app;
