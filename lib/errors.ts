import { HTTPException } from "hono/http-exception";

export class UnauthorizedError extends HTTPException {
  constructor(message = "Unauthorized") {
    super(401, { message });
  }
}

export class ForbiddenError extends HTTPException {
  constructor(message = "Forbidden") {
    super(403, { message });
  }
}

export class NoActiveOrganizationError extends HTTPException {
  constructor(message = "No active organization") {
    super(400, { message });
  }
}

/**
 * Raised when deleting blobs through Juno is not available yet.
 * Follow up with #gt-infra-support about deletion support for sprint planning.
 */
export class JunoFileDeletionNotSupportedError extends Error {
  constructor(
    message = "Juno file deletion is not implemented yet. Contact #gt-infra-support for status.",
  ) {
    super(message);
    this.name = "JunoFileDeletionNotSupportedError";
  }
}
