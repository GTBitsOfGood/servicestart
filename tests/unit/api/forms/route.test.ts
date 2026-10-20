// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockFileService } from "@/tests/unit/mockFileService";
vi.mock("@/lib/services/FileService", () => ({
  FileService: createMockFileService(),
}));
import { FileService } from "@/lib/services/FileService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { OrganizationConfigKey, FormStatus } from "@/lib/schema";
import { app } from "@/lib/app";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  createForm,
  createFormUpload,
  testApi,
} from "@/tests/unit/testUtils";

async function setup(role = "admin", enabled = true) {
  const org = await createOrganization(`forms-api-${randomUUID()}`);
  const { user, session, headers } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, org.id, role);
  await setActiveOrganization(session.id, org.id);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.FormsEnabled,
    String(enabled),
  );
  return { org, user, headers };
}

describe("forms admin API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates, lists, reads, edits and deletes a draft", async () => {
    const { headers } = await setup();
    const created = await testApi.forms.$post(
      { json: { title: "Application", formId: "application" } },
      { headers },
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      title: "Application",
      status: "draft",
    });
    const list = await testApi.forms.$get({}, { headers });
    expect(await list.json()).toMatchObject([
      { formId: "application", questionCount: 0, responseCount: 0 },
    ]);
    const route = testApi.forms[":formId"];
    expect(
      (await route.$get({ param: { formId: "application" } }, { headers }))
        .status,
    ).toBe(200);
    expect(
      (
        await route.$patch(
          {
            param: { formId: "application" },
            json: { title: "New title", formId: "renamed" },
          },
          { headers },
        )
      ).status,
    ).toBe(200);
    expect(
      (await route.$delete({ param: { formId: "renamed" } }, { headers }))
        .status,
    ).toBe(200);
    expect(
      (await route.$get({ param: { formId: "renamed" } }, { headers })).status,
    ).toBe(404);
  });

  it("reports invalid and duplicate IDs and publish validation errors", async () => {
    const { org, headers } = await setup();
    expect(
      (
        await testApi.forms.$post(
          { json: { title: "Bad", formId: "UPPER" } },
          { headers },
        )
      ).status,
    ).toBe(400);
    await createForm(org.id, { formId: "taken", components: [] });
    const duplicate = await testApi.forms.$post(
      { json: { title: "Duplicate", formId: "taken" } },
      { headers },
    );
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ field: "formId" });
    const response = await testApi.forms[":formId"].publish.$post(
      { param: { formId: "taken" } },
      { headers },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Add at least one question before publishing",
    });
  });

  it("publishes, closes, reopens and prevents deleting a published form", async () => {
    const { org, headers } = await setup();
    const form = await createForm(org.id);
    const route = testApi.forms[":formId"];
    const args = { param: { formId: form.formId } };
    expect((await route.publish.$post(args, { headers })).status).toBe(200);
    expect((await route.publish.$post(args, { headers })).status).toBe(409);
    expect((await route.$delete(args, { headers })).status).toBe(409);
    expect((await route.close.$post(args, { headers })).status).toBe(200);
    expect((await route.reopen.$post(args, { headers })).status).toBe(200);
    const csv = await route["export.csv"].$get(args, { headers });
    expect(csv.status).toBe(200);
    expect(csv.headers.get("Content-Type")).toContain("text/csv");
    expect(csv.headers.get("Content-Disposition")).toContain(
      `${form.formId}.csv`,
    );
    expect(await csv.text()).toContain("Student Name");
  });

  it("rejects unauthenticated and non-admin access; conceals private uploads", async () => {
    expect((await testApi.forms.$get()).status).toBe(401);
    const { org, headers } = await setup("member");
    const form = await createForm(org.id);
    const uploadId = await createFormUpload(form);
    const base = `/api/forms/${form.formId}`;
    for (const [path, method] of [
      ["", "GET"],
      ["", "PATCH"],
      ["", "DELETE"],
      ["/publish", "POST"],
      ["/close", "POST"],
      ["/reopen", "POST"],
      ["/export.csv", "GET"],
    ]) {
      expect((await app.request(base + path, { method, headers })).status).toBe(
        403,
      );
    }
    expect(
      (
        await testApi.forms.$post(
          { json: { title: "No", formId: "no" } },
          { headers },
        )
      ).status,
    ).toBe(403);
    expect(
      (await app.request(`${base}/uploads/${uploadId}`, { headers })).status,
    ).toBe(404);
    expect((await app.request(`${base}/uploads/${uploadId}`)).status).toBe(404);
    expect(FileService.readFile).not.toHaveBeenCalled();
  });

  it("returns 404 on every route when forms are disabled", async () => {
    const { org, headers } = await setup("admin", false);
    const form = await createForm(org.id);
    const uploadId = await createFormUpload(form);
    const base = `/api/forms/${form.formId}`;
    for (const [path, method] of [
      ["", "GET"],
      ["", "PATCH"],
      ["", "DELETE"],
      ["/publish", "POST"],
      ["/close", "POST"],
      ["/reopen", "POST"],
      ["/export.csv", "GET"],
      [`/uploads/${uploadId}`, "GET"],
    ]) {
      expect((await app.request(base + path, { method, headers })).status).toBe(
        404,
      );
    }
    expect((await testApi.forms.$get({}, { headers })).status).toBe(404);
    expect(
      (
        await testApi.forms.$post(
          { json: { title: "No", formId: "no" } },
          { headers },
        )
      ).status,
    ).toBe(404);
  });

  it("isolates every operation from another organization and allows independent matching slugs", async () => {
    const a = await setup();
    const b = await setup();
    const form = await createForm(a.org.id, { formId: "application" });
    const uploadId = await createFormUpload(form);
    const base = `/api/forms/${form.formId}`;
    for (const [path, method] of [
      ["", "GET"],
      ["", "PATCH"],
      ["", "DELETE"],
      ["/publish", "POST"],
      ["/close", "POST"],
      ["/reopen", "POST"],
      ["/export.csv", "GET"],
      [`/uploads/${uploadId}`, "GET"],
    ]) {
      expect(
        (
          await app.request(base + path, {
            method,
            headers: { ...b.headers, "Content-Type": "application/json" },
            ...(method === "PATCH"
              ? { body: JSON.stringify({ title: "Attack" }) }
              : {}),
          })
        ).status,
      ).toBe(404);
    }
    const own = await createForm(b.org.id, {
      formId: "application",
      title: "B's form",
      status: FormStatus.Published,
    });
    const response = await testApi.forms[":formId"].$get(
      { param: { formId: own.formId } },
      { headers: b.headers },
    );
    expect(await response.json()).toMatchObject({
      id: own.id,
      title: "B's form",
    });
    expect(
      (await app.request(`${base}/uploads/${uploadId}`, { headers: b.headers }))
        .status,
    ).toBe(404);
    expect(FileService.readFile).not.toHaveBeenCalled();
  });

  it("serves only the specified form's upload and handles missing bytes", async () => {
    const { org, headers } = await setup();
    const form = await createForm(org.id);
    const other = await createForm(org.id);
    const uploadId = await createFormUpload(form, {
      fileName: "headshot.png",
      contentType: "image/png",
    });
    const route = testApi.forms[":formId"].uploads[":uploadId"];
    const args = { param: { formId: form.formId, uploadId } };
    const response = await route.$get(args, { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(await response.text()).toBe("file body");
    expect(FileService.readFile).toHaveBeenCalledWith(org.id, "headshot.png");
    expect(
      (
        await route.$get(
          { param: { formId: other.formId, uploadId } },
          { headers },
        )
      ).status,
    ).toBe(404);
    vi.mocked(FileService.readFile).mockRejectedValueOnce(
      Object.assign(new Error("Missing"), { code: "ENOENT" }),
    );
    expect((await route.$get(args, { headers })).status).toBe(404);
  });
});
