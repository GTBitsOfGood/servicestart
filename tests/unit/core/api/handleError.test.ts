// @vitest-environment node
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vitest";
import { handleError } from "@/core/api/handleError";

describe("shared HTTP errors", () => {
  it.each([400, 401, 403, 404, 409, 413, 500] as const)(
    "renders %i as JSON",
    async (status) => {
      const app = new Hono().onError(handleError).get("/", () => {
        throw new HTTPException(status, { message: "Expected error" });
      });
      const response = await app.request("/");
      expect(response.status).toBe(status);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(await response.json()).toEqual({ error: "Expected error" });
    },
  );

  it("logs unknown errors without disclosing details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const error = new Error("private database details");
      const app = new Hono().onError(handleError).get("/", () => {
        throw error;
      });
      const response = await app.request("/");
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Internal server error" });
      expect(log).toHaveBeenCalledWith(error);
    } finally {
      log.mockRestore();
    }
  });
});
