import type { AppType } from "@/lib/app";
import { hc } from "hono/client";
import { getBaseUrl } from "./clientUtils";

const client = hc<AppType>(getBaseUrl(), {
  init: {
    credentials: "include",
  },
});

export default client.api;
