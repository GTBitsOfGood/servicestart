import { auth } from "@/core/auth/auth";
import { registerMembershipAuthHooks } from "@/features/membership/authHooks";
import { toNextJsHandler } from "better-auth/next-js";

// Signup, sign-in, and member removal fire the membership auth hooks.
registerMembershipAuthHooks();

export const { POST, GET } = toNextJsHandler(auth);
