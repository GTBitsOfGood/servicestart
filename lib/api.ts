import type { AppType } from "@/lib/app";
import { hc } from "hono/client";
import { getBaseUrl } from "@/lib/clientUtils";

const client = hc<AppType>(
  typeof window === "undefined" ? getBaseUrl() : window.location.origin,
  {
    init: {
      credentials: "include",
    },
  },
);

export default client.api;
