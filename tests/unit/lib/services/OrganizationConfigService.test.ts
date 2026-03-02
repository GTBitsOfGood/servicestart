// @vitest-environment node
import { describe, expect, it } from "vitest";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { OrganizationConfigKey } from "@/lib/schema";
import { createOrganization } from "@/tests/unit/testUtils";

describe("OrganizationConfigService - members_page_enabled", () => {
  describe("getConfig with MembersPageEnabled key", () => {
    it("returns 'true' by default when no config has been set", async () => {
      const org = await createOrganization("cfg-mpe-default");

      const config = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);

      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe("true");
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

      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe("false");
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
      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe("true");
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
      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe("false");
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
      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe("true");
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

      expect(config1[OrganizationConfigKey.MembersPageEnabled]).toBe("false");
      expect(config2[OrganizationConfigKey.MembersPageEnabled]).toBe("true");
    });
  });
});
