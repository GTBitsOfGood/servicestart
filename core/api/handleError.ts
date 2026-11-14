import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export const handleError: ErrorHandler = (error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
};
