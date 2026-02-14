import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import { media } from "@/lib/schema";
import { MediaService } from "@/lib/services/MediaService";
import { createOrganization } from "@/tests/unit/testUtils";

describe("MediaService", () => {
  describe("create", () => {
    it("creates a media record with all fields", async () => {
      const org = await createOrganization("media-create");
      const input = {
        organizationId: org.id,
        title: "My Image",
        fileName: "photo.jpg",
        type: "image" as const,
        altText: "A nice photo",
      };

      const created = await MediaService.create(input);

      expect(created).toBeDefined();
      expect(created?.id).toBeDefined();
      expect(created?.organizationId).toBe(org.id);
      expect(created?.title).toBe("My Image");
      expect(created?.fileName).toBe("photo.jpg");
      expect(created?.type).toBe("image");
      expect(created?.altText).toBe("A nice photo");
      expect(created?.uploadedAt).toBeInstanceOf(Date);
    });
  });

  describe("listByOrganization", () => {
    it("returns media for organization with pagination", async () => {
      const org = await createOrganization("media-list");
      await MediaService.create({
        organizationId: org.id,
        title: "First",
        fileName: "first.jpg",
        type: "image",
        altText: "",
      });
      await MediaService.create({
        organizationId: org.id,
        title: "Second",
        fileName: "second.jpg",
        type: "image",
        altText: "",
      });
      await MediaService.create({
        organizationId: org.id,
        title: "Third",
        fileName: "third.jpg",
        type: "image",
        altText: "",
      });

      const page1 = await MediaService.listByOrganization(org.id, {
        limit: 2,
        offset: 0,
      });
      expect(page1).toHaveLength(2);

      const page2 = await MediaService.listByOrganization(org.id, {
        limit: 2,
        offset: 2,
      });
      expect(page2).toHaveLength(1);
      expect(page2[0].title).toBe("Third");
    });

    it("returns empty array when organization has no media", async () => {
      const org = await createOrganization("media-empty");
      const list = await MediaService.listByOrganization(org.id, {
        limit: 10,
        offset: 0,
      });
      expect(list).toHaveLength(0);
    });
  });

  describe("findById", () => {
    it("returns the media record when it exists", async () => {
      const org = await createOrganization("media-find");
      const input = {
        organizationId: org.id,
        title: "Find Me",
        fileName: "find.jpg",
        type: "image" as const,
        altText: "",
      };
      const created = await MediaService.create(input);

      const found = await MediaService.findById(created!.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created!.id);
      expect(found?.title).toBe("Find Me");
    });

    it("returns null when media does not exist", async () => {
      const found = await MediaService.findById("nonexistent-id");
      expect(found).toBeNull();
    });
  });

  describe("update", () => {
    it("updates title and altText", async () => {
      const org = await createOrganization("media-update");
      const created = await MediaService.create({
        organizationId: org.id,
        title: "Original",
        fileName: "original.jpg",
        type: "image",
        altText: "Original alt",
      });

      const updated = await MediaService.update(created!.id, org.id, {
        title: "Updated Title",
        altText: "Updated alt",
      });

      expect(updated).toBeDefined();
      expect(updated?.title).toBe("Updated Title");
      expect(updated?.altText).toBe("Updated alt");
      expect(updated?.fileName).toBe("original.jpg");
    });

    it("updates only title when altText not provided", async () => {
      const org = await createOrganization("media-update-partial");
      const created = await MediaService.create({
        organizationId: org.id,
        title: "Original",
        fileName: "partial.jpg",
        type: "image",
        altText: "Keep this",
      });

      const updated = await MediaService.update(created!.id, org.id, {
        title: "New Title",
      });

      expect(updated?.title).toBe("New Title");
      expect(updated?.altText).toBe("Keep this");
    });

    it("returns null when id does not match organization", async () => {
      const org = await createOrganization("media-update-org");
      const otherOrg = await createOrganization("other-org");
      const created = await MediaService.create({
        organizationId: org.id,
        title: "Mine",
        fileName: "mine.jpg",
        type: "image",
        altText: "",
      });

      const updated = await MediaService.update(created!.id, otherOrg.id, {
        title: "Hacked",
      });

      expect(updated).toBeNull();

      const [unchanged] = await db
        .select()
        .from(media)
        .where(eq(media.id, created!.id));
      expect(unchanged.title).toBe("Mine");
    });
  });

  describe("deleteById", () => {
    it("deletes the media record", async () => {
      const org = await createOrganization("media-delete");
      const created = await MediaService.create({
        organizationId: org.id,
        title: "To Delete",
        fileName: "delete.jpg",
        type: "image",
        altText: "",
      });

      const deleted = await MediaService.deleteById(created!.id, org.id);

      expect(deleted).toBeDefined();
      expect(deleted?.id).toBe(created!.id);

      const found = await MediaService.findById(created!.id);
      expect(found).toBeNull();
    });

    it("returns null when id does not match organization", async () => {
      const org = await createOrganization("media-delete-org");
      const otherOrg = await createOrganization("other-delete");
      const created = await MediaService.create({
        organizationId: org.id,
        title: "Mine",
        fileName: "mine.jpg",
        type: "image",
        altText: "",
      });

      const deleted = await MediaService.deleteById(created!.id, otherOrg.id);

      expect(deleted).toBeNull();

      const found = await MediaService.findById(created!.id);
      expect(found).toBeDefined();
    });
  });
});
