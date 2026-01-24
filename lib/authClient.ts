import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export default createAuthClient({
  plugins: [organizationClient()],
});
