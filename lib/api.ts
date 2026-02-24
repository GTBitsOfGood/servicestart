import type { AppType } from "@/lib/app";
import { hc } from "hono/client";

const client = hc<AppType>(
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  {
    init: {
      credentials: "include",
    },
  },
);

export default client.api;
