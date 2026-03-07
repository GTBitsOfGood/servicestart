import "server-only";
import { headers } from "next/headers";
import { registerQueryServerFetch } from "@/lib/query";
import { app } from "@/lib/app";

registerQueryServerFetch(async (input, init) => {
  const request = new Request(input, init);
  const outgoingHeaders = new Headers(request.headers);

  try {
    const incomingHeaders = await headers();

    const cookie = incomingHeaders.get("cookie");
    if (cookie && !outgoingHeaders.has("cookie")) {
      outgoingHeaders.set("cookie", cookie);
    }

    const authorization = incomingHeaders.get("authorization");
    if (authorization && !outgoingHeaders.has("authorization")) {
      outgoingHeaders.set("authorization", authorization);
    }
  } catch {
    void 0;
  }

  return app.request(new Request(request, { headers: outgoingHeaders }));
});
