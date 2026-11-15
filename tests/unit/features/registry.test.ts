// @vitest-environment node
import { describe, expect, it } from "vitest";
import { OrganizationConfigKey } from "@/core/config/schema";
import { configRegistry, getConfigDefinition } from "@/core/config/registry";
import { WIDGET_IDS } from "@/features/dashboard/lib/schema";
import { getWidgetOptions } from "@/features/dashboard/widgets";
import { NAVBAR_HREFS, NAVBAR_TREE } from "@/features/navigation/navItems";
import { FEATURE_TOGGLES, FEATURES } from "@/features/registry";

const navItems = FEATURES.flatMap(({ toggle, navItems = [] }) =>
  navItems.map((item) => ({ ...item, toggle })),
);
const widgets = FEATURES.flatMap(({ toggle, widgets = [] }) =>
  widgets.map((widget) => ({ ...widget, toggle })),
);

describe("feature manifests", () => {
  it("have unique ids", () => {
    const ids = FEATURES.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(FEATURE_TOGGLES)(
    "toggle %s is a registered config key with a boolean default",
    (toggle) => {
      expect(Object.hasOwn(configRegistry, toggle)).toBe(true);
      expect(typeof getConfigDefinition(toggle).default).toBe("boolean");
    },
  );

  it("have unique navbar hrefs", () => {
    const hrefs = navItems.map(({ href }) => href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("name an existing top-level item as each subpage's parent", () => {
    const topLevel = new Set(
      navItems.filter(({ parent }) => !parent).map(({ href }) => href),
    );
    for (const item of navItems.filter(({ parent }) => parent)) {
      expect([item.href, topLevel.has(item.parent!)]).toEqual([
        item.href,
        true,
      ]);
    }
  });

  it("give top-level items an icon and subpages none", () => {
    for (const item of navItems) {
      expect([item.href, Boolean(item.icon)]).toEqual([
        item.href,
        !item.parent,
      ]);
    }
  });

  it("list every navbar href, whatever the toggles", () => {
    expect([...NAVBAR_HREFS].sort()).toEqual(
      navItems.map(({ href }) => href).sort(),
    );
  });

  it("keep the navbar order", () => {
    expect(
      NAVBAR_TREE.map(({ href, subpages }) => [
        href,
        subpages?.map((page) => page.href),
      ]),
    ).toEqual([
      ["/", undefined],
      ["/members", undefined],
      ["/media", undefined],
      ["/inbox", undefined],
      [
        "/settings",
        [
          "/settings/forms",
          "/settings/member-types",
          "/settings/admindashboard",
          "/settings/dashboard",
          "/settings/dashboard-content",
        ],
      ],
      ["/events", undefined],
    ]);
  });

  // The requireConfig each item and widget had before the manifests (#337).
  const OLD_REQUIRE_CONFIG: Record<string, OrganizationConfigKey> = {
    "/members": OrganizationConfigKey.MembersPageEnabled,
    "/settings/forms": OrganizationConfigKey.FormsEnabled,
    "/settings/member-types": OrganizationConfigKey.MemberTypesEnabled,
    application_status: OrganizationConfigKey.FormsEnabled,
    forms_todo: OrganizationConfigKey.FormsEnabled,
    forms_completed: OrganizationConfigKey.FormsEnabled,
    forms_progress: OrganizationConfigKey.FormsEnabled,
  };

  it.each([
    ...navItems.map((item) => [item.href, item.toggle] as const),
    ...widgets.map((widget) => [widget.id, widget.toggle] as const),
  ])("gate %s by the same toggle as its old requireConfig", (key, toggle) => {
    expect(toggle).toBe(OLD_REQUIRE_CONFIG[key]);
  });

  it("declare exactly the widgets in WIDGET_IDS", () => {
    const ids = widgets.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...WIDGET_IDS].sort());
  });

  it("offer widgets in WIDGET_IDS order when every toggle is on", () => {
    const allOn = Object.fromEntries(FEATURE_TOGGLES.map((key) => [key, true]));
    expect(getWidgetOptions(allOn).map(({ id }) => id)).toEqual([
      ...WIDGET_IDS,
    ]);
  });
});
