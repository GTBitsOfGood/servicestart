import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";
import {
  inferAdditionalFields,
  inferOrgAdditionalFields,
} from "better-auth/client/plugins";

const baseClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    organizationClient({
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
  ],
});

export default baseClient;
