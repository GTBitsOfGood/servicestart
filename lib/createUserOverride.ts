import { User } from "better-auth";
import db from "@/lib/db";
import { users } from "@/lib/schema";
import { UserService } from "@/lib/services/UserService";

interface CreateUserCtx {
  context: {
    organizationId?: string;
    [key: string]: unknown;
  };
}

export function createUserOverride(ctx: CreateUserCtx) {
  return async (user: User) => {
    const organizationId = ctx.context.organizationId;
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
