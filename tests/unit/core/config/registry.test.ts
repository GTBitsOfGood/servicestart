// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  decodeConfigValue,
  encodeConfigValue,
  readableVisibilities,
} from "@/core/config/defineConfig";
import { configRegistry, getConfigDefinition } from "@/core/config/registry";
import { OrganizationConfigKey } from "@/core/config/schema";
import {
  ALLOWED_MOBILE_NAVBAR_VARIANTS,
  mobileVariantShowsIcons,
  resolveMobileProfileOrientation,
  resolveMobileShowIcons,
} from "@/features/navigation/config";
import { CONFIG_SAMPLES } from "@/tests/unit/core/config/configSamples";

const ALL_KEYS = Object.values(OrganizationConfigKey);

describe("config registry", () => {
  it("has a definition for every OrganizationConfigKey", () => {
    const missing = ALL_KEYS.filter(
      (key) => !Object.hasOwn(configRegistry, key),
    );
    expect(missing).toEqual([]);
    for (const key of ALL_KEYS) {
      expect(getConfigDefinition(key).key).toBe(key);
    }
  });

  it("has no definitions for keys that aren't OrganizationConfigKeys", () => {
    expect(Object.keys(configRegistry).sort()).toEqual([...ALL_KEYS].sort());
  });

  it.each(ALL_KEYS)("%s: its default passes its own schema", (key) => {
    const definition = getConfigDefinition(key);
    expect(decodeConfigValue(definition, definition.default)).toEqual({
      success: true,
      data: definition.default,
    });
  });

  it("keeps public only what signed-out pages and proxy.ts read", () => {
    const publicKeys = ALL_KEYS.filter(
      (key) => getConfigDefinition(key).visibility === "public",
    ).sort();
    expect(publicKeys).toEqual(
      [
        OrganizationConfigKey.LogoUrl,
        OrganizationConfigKey.PrimaryColor,
        OrganizationConfigKey.SecondaryColor,
        OrganizationConfigKey.Tagline,
      ].sort(),
    );
  });
});

describe.each(ALL_KEYS)("%s", (key) => {
  const definition = getConfigDefinition(key);
  const sample = CONFIG_SAMPLES[key];

  it("accepts a valid value and stores it in today's format", () => {
    const decoded = decodeConfigValue(definition, sample.valid);
    expect(decoded).toEqual({ success: true, data: sample.valid });
    expect(encodeConfigValue(sample.valid)).toBe(sample.stored);
  });

  it("reads its stored text back to the same value", () => {
    expect(decodeConfigValue(definition, sample.stored)).toEqual({
      success: true,
      data: sample.valid,
    });
  });

  it("rejects an invalid value with a useful message", () => {
    const decoded = decodeConfigValue(definition, sample.invalid);
    expect(decoded.success).toBe(false);
    if (decoded.success) return;
    expect(decoded.error.key).toBe(key);
    // A string matches as a substring.
    expect(decoded.error.message).toMatch(sample.message);
  });
});

describe("decodeConfigValue", () => {
  it("reads booleans stored as text", () => {
    const definition = getConfigDefinition(OrganizationConfigKey.FormsEnabled);
    expect(decodeConfigValue(definition, "true")).toEqual({
      success: true,
      data: true,
    });
    expect(decodeConfigValue(definition, "false")).toEqual({
      success: true,
      data: false,
    });
  });

  it("says when a JSON key's text isn't JSON", () => {
    const decoded = decodeConfigValue(
      getConfigDefinition(OrganizationConfigKey.DashboardLayout),
      "{not json",
    );
    expect(decoded.success).toBe(false);
    if (decoded.success) return;
    expect(decoded.error.message).toBe("Invalid JSON for dashboard layout");
  });

  it("reports a scalar's own message, not a JSON error", () => {
    const decoded = decodeConfigValue(
      getConfigDefinition(OrganizationConfigKey.MembersPageEnabled),
      "maybe",
    );
    expect(decoded.success).toBe(false);
    if (decoded.success) return;
    expect(decoded.error.message).toBe("Value must be 'true' or 'false'");
  });

  it("keeps a string key's value as text even when it looks like JSON", () => {
    const definition = getConfigDefinition(OrganizationConfigKey.Tagline);
    expect(decodeConfigValue(definition, "true")).toEqual({
      success: true,
      data: "true",
    });
    expect(encodeConfigValue("true")).toBe("true");
  });

  it("normalizes JSON values when storing them", () => {
    const definition = getConfigDefinition(
      OrganizationConfigKey.OrganizationFooter,
    );
    const decoded = decodeConfigValue(
      definition,
      '{ "email": "hello@example.com" }',
    );
    expect(decoded.success).toBe(true);
    if (!decoded.success) return;
    expect(encodeConfigValue(decoded.data)).toBe(
      '{"email":"hello@example.com"}',
    );
  });
});

// Behavior carried over from the hand-written getters and setters.
describe("mobile navbar special cases", () => {
  it.each([
    OrganizationConfigKey.MobileNavbarShowIcons,
    OrganizationConfigKey.MobileNavbarProfileOrientation,
  ])("%s: 'inherit' means unset, and unset is null", (key) => {
    const definition = getConfigDefinition(key);
    expect(definition.default).toBeNull();
    expect(decodeConfigValue(definition, "inherit")).toEqual({
      success: true,
      data: null,
    });
  });

  // Navbar.tsx's expression before the registry, copied verbatim. Note that
  // "no-icons" contains "icons", so the no-icons variants show icons; that
  // quirk is kept on purpose.
  function navbarBeforeRegistry(mobileVariant: string) {
    const mobileDrawerSide = mobileVariant.includes("right") ? "right" : "left";
    return (
      mobileVariant.includes("icons") ||
      (mobileDrawerSide === "right" && !mobileVariant.includes("no-icons"))
    );
  }

  it.each(ALLOWED_MOBILE_NAVBAR_VARIANTS)(
    "%s shows icons by default exactly as before",
    (variant) => {
      expect(mobileVariantShowsIcons(variant)).toBe(
        navbarBeforeRegistry(variant),
      );
    },
  );

  it.each([
    ["mobile-left-sidebar", false],
    ["mobile-right-sidebar", true],
    ["mobile-left-sidebar-icons", true],
    ["mobile-right-sidebar-no-icons", true],
    ["mobile-left-sidebar-pinned", false],
    ["mobile-right-sidebar-pinned", true],
    ["mobile-left-sidebar-pinned-icons", true],
    ["mobile-right-sidebar-pinned-no-icons", true],
  ] as const)("%s shows icons by default: %s", (variant, expected) => {
    expect(mobileVariantShowsIcons(variant)).toBe(expected);
  });

  it("uses the org's icon choice over the variant's", () => {
    expect(resolveMobileShowIcons(true, false)).toBe(true);
    expect(resolveMobileShowIcons(false, true)).toBe(false);
    expect(resolveMobileShowIcons(null, true)).toBe(true);
    expect(resolveMobileShowIcons(null, false)).toBe(false);
  });

  it("defaults the profile orientation to horizontal", () => {
    expect(resolveMobileProfileOrientation(null)).toBe("horizontal");
    expect(resolveMobileProfileOrientation("vertical")).toBe("vertical");
  });
});

describe("readableVisibilities", () => {
  it("lets anyone read public keys, members member keys, and admins all", () => {
    expect([...readableVisibilities(null)]).toEqual(["public"]);
    expect([...readableVisibilities("member")].sort()).toEqual([
      "member",
      "public",
    ]);
    expect([...readableVisibilities("admin")].sort()).toEqual([
      "admin",
      "member",
      "public",
    ]);
  });
});
