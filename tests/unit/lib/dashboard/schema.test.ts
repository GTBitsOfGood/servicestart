// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DashboardLayoutSchema } from "@/lib/dashboard/schema";

describe("DashboardLayoutSchema", () => {
  describe("valid layouts", () => {
    it("accepts 2 halves layout (2 tall widgets)", () => {
      const layout = {
        layout: "horizontal",
        widgets: [
          { id: "events", size: "tall" },
          { id: "notifications", size: "tall" },
        ],
      };
      expect(DashboardLayoutSchema.parse(layout)).toEqual(layout);
    });

    it("accepts half + 2 quarters layout", () => {
      const layout = {
        layout: "horizontal",
        widgets: [
          { id: "events", size: "tall" },
          { id: "notifications", size: "small" },
          { id: "member_requests", size: "small" },
        ],
      };
      expect(DashboardLayoutSchema.parse(layout)).toEqual(layout);
    });

    it("accepts 4 quarters layout", () => {
      const layout = {
        layout: "horizontal",
        widgets: [
          { id: "events", size: "small" },
          { id: "notifications", size: "small" },
          { id: "member_requests", size: "small" },
          { id: "newsletter", size: "small" },
        ],
      };
      expect(DashboardLayoutSchema.parse(layout)).toEqual(layout);
    });

    it("accepts 2 quarters + half layout", () => {
      const layout = {
        layout: "horizontal",
        widgets: [
          { id: "events", size: "small" },
          { id: "notifications", size: "small" },
          { id: "member_requests", size: "tall" },
        ],
      };
      expect(DashboardLayoutSchema.parse(layout)).toEqual(layout);
    });

    it("accepts empty widgets array", () => {
      const layout = { layout: "horizontal", widgets: [] };
      expect(DashboardLayoutSchema.parse(layout)).toEqual(layout);
    });

    it("accepts a single widget", () => {
      const layout = {
        layout: "horizontal",
        widgets: [{ id: "events", size: "tall" }],
      };
      expect(DashboardLayoutSchema.parse(layout)).toEqual(layout);
    });

    it("accepts vertical layout direction", () => {
      const layout = {
        layout: "vertical",
        widgets: [{ id: "events", size: "tall" }],
      };
      expect(DashboardLayoutSchema.parse(layout)).toEqual(layout);
    });

    it("accepts all widget IDs", () => {
      const layout = {
        layout: "horizontal",
        widgets: [
          { id: "events", size: "small" },
          { id: "notifications", size: "small" },
          { id: "member_requests", size: "small" },
          { id: "newsletter", size: "small" },
        ],
      };
      expect(DashboardLayoutSchema.parse(layout)).toEqual(layout);
    });

    it("accepts mixed tall and small sizes", () => {
      const layout = {
        layout: "horizontal",
        widgets: [
          { id: "events", size: "tall" },
          { id: "notifications", size: "small" },
        ],
      };
      expect(DashboardLayoutSchema.parse(layout)).toEqual(layout);
    });
  });

  describe("invalid layouts", () => {
    it("rejects more than 4 widgets", () => {
      const layout = {
        layout: "horizontal",
        widgets: [
          { id: "events", size: "small" },
          { id: "notifications", size: "small" },
          { id: "member_requests", size: "small" },
          { id: "newsletter", size: "small" },
          { id: "events", size: "tall" },
        ],
      };
      expect(() => DashboardLayoutSchema.parse(layout)).toThrow();
    });

    it("rejects duplicate widget IDs", () => {
      const layout = {
        layout: "horizontal",
        widgets: [
          { id: "events", size: "tall" },
          { id: "events", size: "small" },
        ],
      };
      expect(() => DashboardLayoutSchema.parse(layout)).toThrow(
        "Duplicate widget IDs are not allowed",
      );
    });

    it("rejects unknown widget IDs", () => {
      const layout = {
        layout: "horizontal",
        widgets: [{ id: "unknown_widget", size: "tall" }],
      };
      expect(() => DashboardLayoutSchema.parse(layout)).toThrow();
    });

    it("rejects unknown sizes", () => {
      const layout = {
        layout: "horizontal",
        widgets: [{ id: "events", size: "huge" }],
      };
      expect(() => DashboardLayoutSchema.parse(layout)).toThrow();
    });

    it("rejects unknown layout direction", () => {
      const layout = {
        layout: "diagonal",
        widgets: [{ id: "events", size: "tall" }],
      };
      expect(() => DashboardLayoutSchema.parse(layout)).toThrow();
    });

    it("rejects missing layout field", () => {
      const layout = {
        widgets: [{ id: "events", size: "tall" }],
      };
      expect(() => DashboardLayoutSchema.parse(layout)).toThrow();
    });

    it("rejects missing widgets field", () => {
      const layout = { layout: "horizontal" };
      expect(() => DashboardLayoutSchema.parse(layout)).toThrow();
    });

    it("rejects widget missing id field", () => {
      const layout = {
        layout: "horizontal",
        widgets: [{ size: "tall" }],
      };
      expect(() => DashboardLayoutSchema.parse(layout)).toThrow();
    });

    it("rejects widget missing size field", () => {
      const layout = {
        layout: "horizontal",
        widgets: [{ id: "events" }],
      };
      expect(() => DashboardLayoutSchema.parse(layout)).toThrow();
    });

    it("rejects null input", () => {
      expect(() => DashboardLayoutSchema.parse(null)).toThrow();
    });

    it("rejects non-object input", () => {
      expect(() => DashboardLayoutSchema.parse("not an object")).toThrow();
    });

    it("rejects widgets as non-array", () => {
      const layout = {
        layout: "horizontal",
        widgets: "not-an-array",
      };
      expect(() => DashboardLayoutSchema.parse(layout)).toThrow();
    });

    it("rejects widget with extra invalid id value type", () => {
      const layout = {
        layout: "horizontal",
        widgets: [{ id: 123, size: "tall" }],
      };
      expect(() => DashboardLayoutSchema.parse(layout)).toThrow();
    });
  });
});
