// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/core/api/errors";
import {
  assertFeatureEnabled,
  notFoundIfFeatureDisabled,
} from "@/core/auth/featureGuards";
import { OrganizationConfigKey } from "@/core/config/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { createOrganization } from "@/tests/unit/testUtils";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

async function orgWithForms(enabled: boolean | null) {
  const org = await createOrganization(
    `guards-${Math.random().toString(36).slice(2, 10)}`,
  );
  if (enabled !== null) {
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.FormsEnabled,
      String(enabled),
    );
  }
  return org;
}

describe(assertFeatureEnabled, () => {
  it("passes while the toggle is on", async () => {
    const org = await orgWithForms(true);
    await expect(
      assertFeatureEnabled(org.id, OrganizationConfigKey.FormsEnabled),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["off", false],
    ["unset (off by default)", null],
  ])("throws a 404 NotFoundError while the toggle is %s", async (_, value) => {
    const org = await orgWithForms(value);
    const error = await assertFeatureEnabled(
      org.id,
      OrganizationConfigKey.FormsEnabled,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).status).toBe(404);
  });

  it("follows a toggle that defaults to on", async () => {
    const org = await orgWithForms(null);
    await expect(
      assertFeatureEnabled(org.id, OrganizationConfigKey.MembersPageEnabled),
    ).resolves.toBeUndefined();
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MembersPageEnabled,
      "false",
    );
    await expect(
      assertFeatureEnabled(org.id, OrganizationConfigKey.MembersPageEnabled),
    ).rejects.toThrow(NotFoundError);
  });

  it("only reads the given organization's toggle", async () => {
    const on = await orgWithForms(true);
    const off = await orgWithForms(false);
    await expect(
      assertFeatureEnabled(on.id, OrganizationConfigKey.FormsEnabled),
    ).resolves.toBeUndefined();
    await expect(
      assertFeatureEnabled(off.id, OrganizationConfigKey.FormsEnabled),
    ).rejects.toThrow(NotFoundError);
  });
});

describe(notFoundIfFeatureDisabled, () => {
  it("returns while the toggle is on", async () => {
    const org = await orgWithForms(true);
    await expect(
      notFoundIfFeatureDisabled(org.id, OrganizationConfigKey.FormsEnabled),
    ).resolves.toBeUndefined();
  });

  it("renders the not-found page while the toggle is off", async () => {
    const org = await orgWithForms(false);
    await expect(
      notFoundIfFeatureDisabled(org.id, OrganizationConfigKey.FormsEnabled),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
