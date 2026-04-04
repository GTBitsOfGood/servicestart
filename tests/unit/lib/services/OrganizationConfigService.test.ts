// @vitest-environment node
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import db from "@/lib/db";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { organizationConfig, OrganizationConfigKey } from "@/lib/schema";
import { createOrganization } from "@/tests/unit/testUtils";
import {
  DEFAULT_ADMIN_LAYOUT,
  DEFAULT_MEMBER_LAYOUT,
} from "@/lib/dashboard/constants";

describe("OrganizationConfigService - members_page_enabled", () => {
  describe("getConfig with MembersPageEnabled key", () => {
    it("returns 'true' by default when no config has been set", async () => {
      const org = await createOrganization("cfg-mpe-default");

      const config = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);

      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe(true);
    });

    it("returns stored value after setConfig", async () => {
      const org = await createOrganization("cfg-mpe-stored");

      await OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.MembersPageEnabled,
        "false",
      );

      const config = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);

      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe(false);
    });
  });

  describe("setConfig with MembersPageEnabled key", () => {
    it("sets value to 'true'", async () => {
      const org = await createOrganization("cfg-mpe-set-true");

      await OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.MembersPageEnabled,
        "true",
      );

      const config = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);
      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe(true);
    });

    it("sets value to 'false'", async () => {
      const org = await createOrganization("cfg-mpe-set-false");

      await OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.MembersPageEnabled,
        "false",
      );

      const config = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);
      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe(false);
    });

    it("updates existing value (upsert)", async () => {
      const org = await createOrganization("cfg-mpe-upsert");

      await OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.MembersPageEnabled,
        "false",
      );
      await OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.MembersPageEnabled,
        "true",
      );

      const config = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);
      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe(true);
    });

    it("throws for invalid value", async () => {
      const org = await createOrganization("cfg-mpe-invalid");

      await expect(
        OrganizationConfigService.setConfig(
          org.id,
          OrganizationConfigKey.MembersPageEnabled,
          "yes",
        ),
      ).rejects.toThrow("Value must be 'true' or 'false'");
    });

    it("is isolated per organization", async () => {
      const org1 = await createOrganization("cfg-mpe-iso1");
      const org2 = await createOrganization("cfg-mpe-iso2");

      await OrganizationConfigService.setConfig(
        org1.id,
        OrganizationConfigKey.MembersPageEnabled,
        "false",
      );

      const config1 = await OrganizationConfigService.getConfig(org1.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);
      const config2 = await OrganizationConfigService.getConfig(org2.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);

      expect(config1[OrganizationConfigKey.MembersPageEnabled]).toBe(false);
      expect(config2[OrganizationConfigKey.MembersPageEnabled]).toBe(true);
    });
  });
});

describe("OrganizationConfigService - AdminDashboardLayout", () => {
  it("returns default admin layout when no config exists", async () => {
    const org = await createOrganization("cfg-adl-default");
    const layout = await OrganizationConfigService.getAdminDashboardLayout(
      org.id,
    );
    expect(layout).toEqual(DEFAULT_ADMIN_LAYOUT);
  });

  it("stores and retrieves a valid layout", async () => {
    const org = await createOrganization("cfg-adl-store");
    const testLayout = {
      layout: "horizontal" as const,
      widgets: [
        { id: "events" as const, size: "tall" as const },
        { id: "notifications" as const, size: "small" as const },
        { id: "member_requests" as const, size: "small" as const },
      ],
    };

    await OrganizationConfigService.setAdminDashboardLayout(
      org.id,
      JSON.stringify(testLayout),
    );

    const retrieved = await OrganizationConfigService.getAdminDashboardLayout(
      org.id,
    );
    expect(retrieved).toEqual(testLayout);
  });

  it("updates existing layout (upsert)", async () => {
    const org = await createOrganization("cfg-adl-upsert");
    const layout1 = {
      layout: "horizontal",
      widgets: [{ id: "events", size: "tall" }],
    };
    const layout2 = {
      layout: "horizontal",
      widgets: [
        { id: "notifications", size: "tall" },
        { id: "newsletter", size: "tall" },
      ],
    };

    await OrganizationConfigService.setAdminDashboardLayout(
      org.id,
      JSON.stringify(layout1),
    );
    await OrganizationConfigService.setAdminDashboardLayout(
      org.id,
      JSON.stringify(layout2),
    );

    const retrieved = await OrganizationConfigService.getAdminDashboardLayout(
      org.id,
    );
    expect(retrieved).toEqual(layout2);
  });

  it("rejects invalid JSON", async () => {
    const org = await createOrganization("cfg-adl-bad-json");
    await expect(
      OrganizationConfigService.setAdminDashboardLayout(
        org.id,
        "not valid json",
      ),
    ).rejects.toThrow("Invalid JSON for admin dashboard layout");
  });

  it("rejects invalid layout structure", async () => {
    const org = await createOrganization("cfg-adl-bad-layout");
    await expect(
      OrganizationConfigService.setAdminDashboardLayout(
        org.id,
        JSON.stringify({ layout: "diagonal", widgets: [] }),
      ),
    ).rejects.toThrow("Invalid admin dashboard layout");
  });

  it("returns default when stored value is corrupted", async () => {
    const org = await createOrganization("cfg-adl-corrupt");
    await db.insert(organizationConfig).values({
      id: randomUUID(),
      organizationId: org.id,
      key: OrganizationConfigKey.AdminDashboardLayout,
      value: "corrupted-data",
    });

    const layout = await OrganizationConfigService.getAdminDashboardLayout(
      org.id,
    );
    expect(layout).toEqual(DEFAULT_ADMIN_LAYOUT);
  });
});

describe("OrganizationConfigService - DashboardLayout", () => {
  it("returns default member layout when no config exists", async () => {
    const org = await createOrganization("cfg-dl-default");
    const layout = await OrganizationConfigService.getDashboardLayout(org.id);
    expect(layout).toEqual(DEFAULT_MEMBER_LAYOUT);
  });

  it("stores and retrieves a valid layout", async () => {
    const org = await createOrganization("cfg-dl-store");
    const testLayout = {
      layout: "horizontal" as const,
      widgets: [
        { id: "events" as const, size: "tall" as const },
        { id: "newsletter" as const, size: "tall" as const },
      ],
    };

    await OrganizationConfigService.setDashboardLayout(
      org.id,
      JSON.stringify(testLayout),
    );

    const retrieved = await OrganizationConfigService.getDashboardLayout(
      org.id,
    );
    expect(retrieved).toEqual(testLayout);
  });

  it("rejects invalid JSON", async () => {
    const org = await createOrganization("cfg-dl-bad-json");
    await expect(
      OrganizationConfigService.setDashboardLayout(org.id, "not valid json"),
    ).rejects.toThrow("Invalid JSON for dashboard layout");
  });

  it("rejects invalid layout structure", async () => {
    const org = await createOrganization("cfg-dl-bad-layout");
    await expect(
      OrganizationConfigService.setDashboardLayout(
        org.id,
        JSON.stringify({ widgets: [{ id: "unknown", size: "huge" }] }),
      ),
    ).rejects.toThrow("Invalid dashboard layout");
  });

  it("is isolated per organization", async () => {
    const org1 = await createOrganization("cfg-dl-iso1");
    const org2 = await createOrganization("cfg-dl-iso2");

    const layout1 = {
      layout: "horizontal",
      widgets: [{ id: "events", size: "tall" }],
    };

    await OrganizationConfigService.setDashboardLayout(
      org1.id,
      JSON.stringify(layout1),
    );

    const retrieved1 = await OrganizationConfigService.getDashboardLayout(
      org1.id,
    );
    const retrieved2 = await OrganizationConfigService.getDashboardLayout(
      org2.id,
    );

    expect(retrieved1).toEqual(layout1);
    expect(retrieved2).toEqual(DEFAULT_MEMBER_LAYOUT);
  });
});
