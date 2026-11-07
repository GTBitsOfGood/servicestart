import type { AppType } from "@/features/app";
import { hc } from "hono/client";
import { getBaseUrl } from "@/core/utils/clientUtils";

const client = hc<AppType>(
  typeof window === "undefined" ? getBaseUrl() : window.location.origin,
  {
    init: {
      credentials: "include",
    },
  },
);

export default client.api;
