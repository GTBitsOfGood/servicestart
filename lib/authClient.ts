import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";
import { inferAdditionalFields } from "better-auth/client/plugins";

export default createAuthClient({
  plugins: [organizationClient(), inferAdditionalFields<typeof auth>()],
});
