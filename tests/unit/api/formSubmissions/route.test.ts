// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "@/lib/db";
import {
  FormComponentType,
  FormStatus,
  OrganizationConfigKey,
  formAnswers,
  formSubmissions,
  formUploads,
  media,
} from "@/lib/schema";
import { FORM_UPLOAD_MAX_BYTES } from "@/lib/forms/constants";
import type { FormSettings } from "@/lib/forms/schema";
import { FileService } from "@/lib/services/FileService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import {
  addMember,
  buildHost,
  buildSampleAnswers,
  buildTestUser,
  createForm,
  createFormSubmission,
  createFormUpload,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
  type TestForm,
} from "@/tests/unit/testUtils";

vi.mock("@/lib/services/FileService", async () => {
  const { createMockFileService } =
    await import("@/tests/unit/mockFileService");
  return { FileService: createMockFileService() };
});

import { app } from "@/lib/app";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 "),
]);

const HOUR = 60 * 60 * 1000;

async function createOrg(slug: string, { formsEnabled = true } = {}) {
  const organization = await createOrganization(slug);
  await OrganizationConfigService.setConfig(
    organization.id,
    OrganizationConfigKey.FormsEnabled,
    String(formsEnabled),
  );
  return organization;
}

/** Signs up a user, optionally as a member of `organizationId`. */
async function signIn(organizationId?: string) {
  const { user, session, headers } = await signUpAndGetSession(buildTestUser());
  if (organizationId) {
    await addMember(user.id, organizationId, "member");
    await setActiveOrganization(session.id, organizationId);
  }
  return { userId: user.id, cookie: headers.Cookie };
}

function headersFor(slug: string, cookie?: string): Record<string, string> {
  return cookie
    ? { host: buildHost(slug), Cookie: cookie }
    : { host: buildHost(slug) };
}

function submit(
  slug: string,
  formId: string,
  answers: Record<string, unknown>,
  cookie?: string,
) {
  return testApi.forms[":formId"].submissions.$post(
    { param: { formId }, json: { answers } as never },
    { headers: headersFor(slug, cookie) },
  );
}

async function fieldErrorsOf(res: Awaited<ReturnType<typeof submit>>) {
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  return (await res.json()).fieldErrors;
}

// Sends a Content-Length, as browsers do for multipart uploads.
async function upload(
  slug: string,
  formId: string,
  file: Blob | null,
  cookie?: string,
) {
  const formData = new FormData();
  if (file) formData.append("file", file, "headshot");
  const encoded = new Response(formData);
  const body = await encoded.arrayBuffer();
  return app.request(`/api/forms/${formId}/uploads`, {
    method: "POST",
    body,
    headers: {
      ...headersFor(slug, cookie),
      "Content-Type": encoded.headers.get("Content-Type")!,
      "Content-Length": String(body.byteLength),
    },
  });
}

const png = () => new Blob([PNG], { type: "image/png" });

async function publishedForm(
  organizationId: string,
  settings: Partial<FormSettings> = {},
) {
  return createForm(organizationId, { status: FormStatus.Published, settings });
}

async function validAnswers(form: TestForm, uploadedBy: string | null) {
  const uploadId = await createFormUpload(form, { uploadedBy });
  return buildSampleAnswers(form, { uploadId });
}

function imageComponentId(form: TestForm) {
  return form.components.find(({ type }) => type === FormComponentType.Image)!
    .id;
}

beforeEach(() => {
  vi.mocked(FileService.upload).mockClear();
});

describe("POST /api/forms/:formId/submissions", () => {
  it("saves a member's submission and its answers", async () => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id);
    const { userId, cookie } = await signIn(org.id);
    const answers = await validAnswers(form, userId);
    const phoneId = form.components.find(
      ({ type }) => type === FormComponentType.Phone,
    )!.id;

    const res = await submit(
      "acme",
      form.formId,
      { ...answers, [phoneId]: "(404) 555-0123" },
      cookie,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      confirmationMessage: string;
    };
    expect(body.confirmationMessage).toBe(form.settings.confirmationMessage);
    const [submission] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, body.id));
    expect(submission).toMatchObject({
      formId: form.id,
      organizationId: org.id,
      userId,
    });
    const rows = await db
      .select()
      .from(formAnswers)
      .where(eq(formAnswers.submissionId, body.id));
    expect(rows).toHaveLength(Object.keys(answers).length);
    expect(rows.find((row) => row.componentId === phoneId)?.value).toBe(
      "4045550123",
    );
  });

  it("returns 404 when forms are off", async () => {
    const org = await createOrg("acme", { formsEnabled: false });
    const form = await publishedForm(org.id);
    const { userId, cookie } = await signIn(org.id);

    const res = await submit(
      "acme",
      form.formId,
      await validAnswers(form, userId),
      cookie,
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for a draft form", async () => {
    const org = await createOrg("acme");
    const form = await createForm(org.id, { status: FormStatus.Draft });
    const { userId, cookie } = await signIn(org.id);

    const res = await submit(
      "acme",
      form.formId,
      await validAnswers(form, userId),
      cookie,
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for a missing form or a malformed form ID", async () => {
    await createOrg("acme");
    const { cookie } = await signIn();

    expect((await submit("acme", "missing", {}, cookie)).status).toBe(404);
    expect((await submit("acme", "Not_A_Form", {}, cookie)).status).toBe(404);
  });

  it.each([
    ["closed", FormStatus.Closed, {}],
    [
      "past its close time",
      FormStatus.Published,
      { closesAt: new Date(Date.now() - HOUR).toISOString() },
    ],
    [
      "not yet open",
      FormStatus.Published,
      { opensAt: new Date(Date.now() + HOUR).toISOString() },
    ],
  ])("rejects a form that's %s", async (_, status, settings) => {
    const org = await createOrg("acme");
    const form = await createForm(org.id, { status, settings });
    const { userId, cookie } = await signIn(org.id);

    const res = await submit(
      "acme",
      form.formId,
      await validAnswers(form, userId),
      cookie,
    );
    expect(res.status).toBe(403);
    expect(await db.select().from(formSubmissions)).toHaveLength(0);
  });

  it("accepts a submission inside the open window", async () => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id, {
      opensAt: new Date(Date.now() - HOUR).toISOString(),
      closesAt: new Date(Date.now() + HOUR).toISOString(),
    });
    const { userId, cookie } = await signIn(org.id);

    const res = await submit(
      "acme",
      form.formId,
      await validAnswers(form, userId),
      cookie,
    );
    expect(res.status).toBe(201);
  });

  describe("when the form requires login", () => {
    it("returns 401 for a guest", async () => {
      const org = await createOrg("acme");
      const form = await publishedForm(org.id);

      const res = await submit(
        "acme",
        form.formId,
        await validAnswers(form, null),
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 for a signed-in user who isn't a member", async () => {
      const org = await createOrg("acme");
      const form = await publishedForm(org.id);
      const { userId, cookie } = await signIn();

      const res = await submit(
        "acme",
        form.formId,
        await validAnswers(form, userId),
        cookie,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("when the form doesn't require login", () => {
    it("accepts a guest's submission without a user", async () => {
      const org = await createOrg("acme");
      const form = await publishedForm(org.id, { requireLogin: false });

      const res = await submit(
        "acme",
        form.formId,
        await validAnswers(form, null),
      );

      expect(res.status).toBe(201);
      const [submission] = await db.select().from(formSubmissions);
      expect(submission.userId).toBeNull();
    });

    it("links a member's submission to them", async () => {
      const org = await createOrg("acme");
      const form = await publishedForm(org.id, { requireLogin: false });
      const { userId, cookie } = await signIn(org.id);

      const res = await submit(
        "acme",
        form.formId,
        await validAnswers(form, userId),
        cookie,
      );

      expect(res.status).toBe(201);
      const [submission] = await db.select().from(formSubmissions);
      expect(submission.userId).toBe(userId);
    });
  });

  it("returns 409 for a second submission from the same user", async () => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id);
    const { userId, cookie } = await signIn(org.id);
    await createFormSubmission(form, { userId });

    const res = await submit(
      "acme",
      form.formId,
      await validAnswers(form, userId),
      cookie,
    );
    expect(res.status).toBe(409);
  });

  it("accepts repeat submissions when the form allows them", async () => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id, {
      allowMultipleSubmissions: true,
    });
    const { userId, cookie } = await signIn(org.id);
    const answers = await validAnswers(form, userId);

    expect((await submit("acme", form.formId, answers, cookie)).status).toBe(
      201,
    );
    expect((await submit("acme", form.formId, answers, cookie)).status).toBe(
      201,
    );
  });

  it("returns errors for each invalid answer", async () => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id);
    const { userId, cookie } = await signIn(org.id);
    const answers = await validAnswers(form, userId);
    const email = form.components.find(
      ({ type }) => type === FormComponentType.Email,
    )!;
    const required = form.components.find(
      ({ type, required }) => type === FormComponentType.ShortText && required,
    )!;
    delete answers[required.id];

    const res = await submit(
      "acme",
      form.formId,
      { ...answers, [email.id]: "not-an-email" },
      cookie,
    );

    expect(await fieldErrorsOf(res)).toEqual({
      [required.id]: "This question is required",
      [email.id]: "Enter a valid email address",
    });
    expect(await db.select().from(formSubmissions)).toHaveLength(0);
  });

  describe("rejects an image answer's upload when it's from", () => {
    it("another user", async () => {
      const org = await createOrg("acme");
      const form = await publishedForm(org.id);
      const other = await signIn(org.id);
      const { cookie } = await signIn(org.id);

      const res = await submit(
        "acme",
        form.formId,
        await validAnswers(form, other.userId),
        cookie,
      );

      expect(await fieldErrorsOf(res)).toEqual({
        [imageComponentId(form)]: "Upload this image again",
      });
    });

    it("another form", async () => {
      const org = await createOrg("acme");
      const form = await publishedForm(org.id);
      const otherForm = await publishedForm(org.id);
      const { userId, cookie } = await signIn(org.id);
      const uploadId = await createFormUpload(otherForm, {
        uploadedBy: userId,
      });

      const res = await submit(
        "acme",
        form.formId,
        buildSampleAnswers(form, { uploadId }),
        cookie,
      );
      expect(res.status).toBe(400);
    });

    it("another org", async () => {
      const org = await createOrg("acme");
      const otherOrg = await createOrg("other");
      const form = await publishedForm(org.id);
      const otherForm = await publishedForm(otherOrg.id);
      const { userId, cookie } = await signIn(org.id);
      const uploadId = await createFormUpload(otherForm, {
        uploadedBy: userId,
      });

      const res = await submit(
        "acme",
        form.formId,
        buildSampleAnswers(form, { uploadId }),
        cookie,
      );
      expect(res.status).toBe(400);
    });

    it("a signed-in user, for a guest", async () => {
      const org = await createOrg("acme");
      const form = await publishedForm(org.id, { requireLogin: false });
      const { userId } = await signIn(org.id);

      const res = await submit(
        "acme",
        form.formId,
        await validAnswers(form, userId),
      );
      expect(res.status).toBe(400);
    });
  });

  it("returns 404 for org A's form from org B's host", async () => {
    const orgA = await createOrg("org-a");
    await createOrg("org-b");
    const form = await publishedForm(orgA.id, { requireLogin: false });

    const res = await submit(
      "org-b",
      form.formId,
      await validAnswers(form, null),
    );

    expect(res.status).toBe(404);
    expect(await db.select().from(formSubmissions)).toHaveLength(0);
  });
});

describe("POST /api/forms/:formId/uploads", () => {
  it("stores the image and records an upload without a media row", async () => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id);
    const { userId, cookie } = await signIn(org.id);

    const res = await upload("acme", form.formId, png(), cookie);

    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const [row] = await db
      .select()
      .from(formUploads)
      .where(eq(formUploads.id, id));
    expect(row).toMatchObject({
      organizationId: org.id,
      formId: form.id,
      uploadedBy: userId,
      contentType: "image/png",
      sizeBytes: PNG.length,
    });
    expect(row.fileName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(FileService.upload).toHaveBeenCalledWith(
      { organizationId: org.id, fileName: row.fileName },
      expect.any(File),
    );
    expect(await db.select().from(media)).toHaveLength(0);
  });

  it.each([
    ["JPEG", JPEG, "image/jpeg", ".jpg"],
    ["WebP", WEBP, "image/webp", ".webp"],
  ])("accepts a %s image", async (_, bytes, type, extension) => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id);
    const { cookie } = await signIn(org.id);

    const res = await upload(
      "acme",
      form.formId,
      new Blob([bytes], { type }),
      cookie,
    );

    expect(res.status).toBe(201);
    const [row] = await db.select().from(formUploads);
    expect(row.fileName.endsWith(extension)).toBe(true);
  });

  it("lets a guest upload to a form that doesn't require login", async () => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id, { requireLogin: false });

    const res = await upload("acme", form.formId, png());

    expect(res.status).toBe(201);
    const [row] = await db.select().from(formUploads);
    expect(row.uploadedBy).toBeNull();
  });

  it.each([
    ["a missing file", null, "image/png"],
    ["a GIF", PNG, "image/gif"],
    ["an SVG", Buffer.from("<svg/>"), "image/svg+xml"],
    ["a text file", Buffer.from("hello"), "text/plain"],
    ["bytes that don't match the type", Buffer.from("hello"), "image/png"],
  ])("rejects %s", async (_, bytes, type) => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id);
    const { cookie } = await signIn(org.id);

    const res = await upload(
      "acme",
      form.formId,
      bytes && new Blob([bytes], { type }),
      cookie,
    );

    expect(res.status).toBe(400);
    expect(FileService.upload).not.toHaveBeenCalled();
    expect(await db.select().from(formUploads)).toHaveLength(0);
  });

  it.each([
    ["just over 5 MB", FORM_UPLOAD_MAX_BYTES + 1],
    ["far over 5 MB", FORM_UPLOAD_MAX_BYTES * 2],
  ])("rejects an image %s", async (_, size) => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id);
    const { cookie } = await signIn(org.id);
    const bytes = Buffer.alloc(size);
    PNG.copy(bytes);

    const res = await upload(
      "acme",
      form.formId,
      new Blob([bytes], { type: "image/png" }),
      cookie,
    );

    expect(res.status).toBe(413);
    expect(FileService.upload).not.toHaveBeenCalled();
  });

  it("accepts an image of exactly 5 MB", async () => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id);
    const { cookie } = await signIn(org.id);
    const bytes = Buffer.alloc(FORM_UPLOAD_MAX_BYTES);
    PNG.copy(bytes);

    const res = await upload(
      "acme",
      form.formId,
      new Blob([bytes], { type: "image/png" }),
      cookie,
    );
    expect(res.status).toBe(201);
  });

  it("returns 404 when forms are off", async () => {
    const org = await createOrg("acme", { formsEnabled: false });
    const form = await publishedForm(org.id);
    const { cookie } = await signIn(org.id);

    expect((await upload("acme", form.formId, png(), cookie)).status).toBe(404);
  });

  it("returns 404 for a draft form", async () => {
    const org = await createOrg("acme");
    const form = await createForm(org.id, { status: FormStatus.Draft });
    const { cookie } = await signIn(org.id);

    expect((await upload("acme", form.formId, png(), cookie)).status).toBe(404);
  });

  it("returns 403 for a closed form", async () => {
    const org = await createOrg("acme");
    const form = await createForm(org.id, { status: FormStatus.Closed });
    const { cookie } = await signIn(org.id);

    expect((await upload("acme", form.formId, png(), cookie)).status).toBe(403);
  });

  it("requires a member when the form requires login", async () => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id);
    const { cookie } = await signIn();

    expect((await upload("acme", form.formId, png())).status).toBe(401);
    expect((await upload("acme", form.formId, png(), cookie)).status).toBe(403);
  });

  it("returns 409 after the user has submitted", async () => {
    const org = await createOrg("acme");
    const form = await publishedForm(org.id);
    const { userId, cookie } = await signIn(org.id);
    await createFormSubmission(form, { userId });

    expect((await upload("acme", form.formId, png(), cookie)).status).toBe(409);
  });

  it("returns 400 for a form without an image question", async () => {
    const org = await createOrg("acme");
    const form = await createForm(org.id, {
      status: FormStatus.Published,
      components: [],
    });
    const { cookie } = await signIn(org.id);

    expect((await upload("acme", form.formId, png(), cookie)).status).toBe(400);
  });

  it("returns 404 for org A's form from org B's host", async () => {
    const orgA = await createOrg("org-a");
    await createOrg("org-b");
    const form = await publishedForm(orgA.id, { requireLogin: false });

    const res = await upload("org-b", form.formId, png());

    expect(res.status).toBe(404);
    expect(FileService.upload).not.toHaveBeenCalled();
    expect(await db.select().from(formUploads)).toHaveLength(0);
  });
});
