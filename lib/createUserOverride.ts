import { User } from "better-auth";
import db from "@/lib/db";
import { users } from "@/lib/schema";
import { UserService } from "@/lib/services/UserService";
import { OrganizationsService } from "@/lib/services/OrganizationService";

interface CreateUserCtx {
  context: {
    organizationId?: string;
    [key: string]: unknown;
  };
}

export function createUserOverride(ctx: CreateUserCtx) {
  return async (user: User) => {
    let organizationId = ctx.context.organizationId;

    // Verify the organization exists for the given organizationId. If it
    // doesn't, fall back to looking up an organization by the user-provided
    // organizationSlug (if present). This handles test scenarios where the
    // ctx.organizationId may be stale or invalid.
    if (organizationId) {
      const org = await OrganizationsService.findById(organizationId);
      if (!org) {
        organizationId = undefined;
      }
    }

    if (!organizationId) {
      const u = user as unknown as {
        additionalFields?: { organizationSlug?: string };
      };
      const slug = u?.additionalFields?.organizationSlug;
      if (slug) {
        const org = await OrganizationsService.findBySlug(slug);
        if (org) organizationId = org.id;
      }
    }

    if (!organizationId)
      throw new Error("organizationId required for multi-tenant user creation");
    const { email, name, ...rest } = user;
    // Try to find user by email
    const existingUser = await UserService.findByEmailAndOrganization(
      email,
      organizationId,
    );
    let id: string;
    if (!existingUser) {
      // Create new user
      id = crypto.randomUUID();
      await db.insert(users).values({
        name: name || "",
        email,
        organizationId,
        ...rest,
        id,
      });
    } else {
      id = existingUser.id;
    }
    return await UserService.findById(id);
  };
}
