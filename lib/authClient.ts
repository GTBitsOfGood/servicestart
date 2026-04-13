import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";
import {
  inferAdditionalFields,
  inferOrgAdditionalFields,
} from "better-auth/client/plugins";
import { getSlugFromHostname } from "./utils";

export function getOrganizationId() {
  if (typeof window !== "undefined") {
    // Try to get from global context, or parse from subdomain, or use injected context
    if ((window as any).__ACTIVE_ORG_ID__)
      return (window as any).__ACTIVE_ORG_ID__;
    // Optionally, parse from subdomain or other logic here
  }
  return null;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (typeof val !== "object" || val === null) return false;
  // Do not wrap Promises or thenables
  if (typeof (val as { then?: unknown }).then === "function") return false;
  // Do not wrap arrays
  if (Array.isArray(val)) return false;
  return Object.prototype.toString.call(val) === "[object Object]";
}

function wrapWithOrgProxy(obj: any): any {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return function (...args: unknown[]) {
          const orgId = getOrganizationId();
          if (args.length > 1 && orgId) {
            if (args[1] && typeof args[1] === "object") {
              if (!("fetchOptions" in args[1]))
                (args[1] as any).fetchOptions = {};
              if (!("headers" in (args[1] as any).fetchOptions))
                (args[1] as any).fetchOptions.headers = {};
              (args[1] as any).fetchOptions.headers["x-organization-id"] =
                orgId;
            }
          }
          return value.apply(target, args);
        };
      } else if (isPlainObject(value)) {
        return wrapWithOrgProxy(value);
      }
      return value;
    },
  });
}

const baseClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    organizationClient({
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
  ],
  fetchOptions: {
    onRequest: async (ctx) => {
      const slug = getSlugFromHostname(window.location.hostname);
      ctx.headers.set("x-organization-slug", slug);
      return ctx;
    },
  },
});

// const authClient = wrapWithOrgProxy(baseClient);
export default baseClient;
