import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  MemberTypeError,
  type MemberTypeErrorReason,
} from "@/features/membership/lib/memberTypeErrors";

const memberTypeErrorStatus = (reason: MemberTypeErrorReason) => {
  switch (reason) {
    case "invalid":
      return 400;
    case "not_found":
      return 404;
    case "in_use":
      return 409;
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
};

export const handleMemberTypeRouteError = (error: unknown, c: Context) => {
  if (error instanceof MemberTypeError) {
    const body: { error: string; members?: number; forms?: number } = {
      error: error.message,
    };
    if (error.reason === "in_use" && error.inUse) {
      body.members = error.inUse.members;
      body.forms = error.inUse.forms;
    }
    return c.json(body, memberTypeErrorStatus(error.reason));
  }
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  console.error(error);
  return c.json({ error: "Unable to complete the request" }, 500);
};
