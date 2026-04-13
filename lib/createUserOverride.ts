import { User } from "better-auth";
import db from "@/lib/db";
import { users } from "@/lib/schema";
import { UserService } from "@/lib/services/UserService";

export function createUserOverride(ctx: any) {
  return async (user: User) => {
    const organizationId = ctx.context.organizationId;
    if (!organizationId)
      throw new Error("organizationId required for multi-tenant user creation");
    const { email, name, ...rest } = user;
    // Try to find user by email
    let existingUser = await UserService.findByEmailAndOrganization(
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
        ...rest,
        id,
      });
      existingUser = await UserService.findById(id);
    } else {
      id = existingUser.id;
    }
    return await UserService.findById(id);
  };
}
