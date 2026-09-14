// @vitest-environment node
import { describe, expect, it } from "vitest";
import { OrganizationConfigKey } from "@/lib/schema";
import { DEFAULT_BRANDING, resolveBranding } from "@/lib/branding";

describe("resolveBranding", () => {
  it("returns documented defaults when no branding keys are present", () => {
    const branding = resolveBranding({});

    expect(branding[OrganizationConfigKey.PrimaryColor]).toBe("#FD8033");
    expect(branding[OrganizationConfigKey.SecondaryColor]).toBe("#FB3552");
    expect(branding).toEqual({
      [OrganizationConfigKey.PrimaryColor]:
        DEFAULT_BRANDING[OrganizationConfigKey.PrimaryColor],
      [OrganizationConfigKey.SecondaryColor]:
        DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
    });
  });

  it("keeps a configured primary color and fills in the default secondary", () => {
    const branding = resolveBranding({
      [OrganizationConfigKey.PrimaryColor]: "#000000",
    });

    expect(branding[OrganizationConfigKey.PrimaryColor]).toBe("#000000");
    expect(branding[OrganizationConfigKey.SecondaryColor]).toBe(
      DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
    );
  });

  it("keeps a configured secondary color and fills in the default primary", () => {
    const branding = resolveBranding({
      [OrganizationConfigKey.SecondaryColor]: "#111111",
    });

    expect(branding[OrganizationConfigKey.PrimaryColor]).toBe(
      DEFAULT_BRANDING[OrganizationConfigKey.PrimaryColor],
    );
    expect(branding[OrganizationConfigKey.SecondaryColor]).toBe("#111111");
  });

  it("does not override a fully configured organization", () => {
    const branding = resolveBranding({
      [OrganizationConfigKey.PrimaryColor]: "#123456",
      [OrganizationConfigKey.SecondaryColor]: "#654321",
    });

    expect(branding[OrganizationConfigKey.PrimaryColor]).toBe("#123456");
    expect(branding[OrganizationConfigKey.SecondaryColor]).toBe("#654321");
  });

  it("treats an empty string as an explicit value, not a missing one", () => {
    const branding = resolveBranding({
      [OrganizationConfigKey.PrimaryColor]: "",
    });

    expect(branding[OrganizationConfigKey.PrimaryColor]).toBe("");
    expect(branding[OrganizationConfigKey.SecondaryColor]).toBe(
      DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
    );
  });
});
