"use client";

import { useEffect, useState } from "react";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import api from "@/lib/api";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

type ConfigResult<K extends readonly string[]> = Partial<
  Record<K[number], string>
>;

export type ConfigStatus = "ok" | "not-found" | "error";

type ConfigState<K extends readonly string[]> = {
  stateKey: string;
  data: ConfigResult<K>;
  status: ConfigStatus;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
// Bumped from "org-config" so entries poisoned by the pre-#252 bug (error bodies
// cached as config values, 5 minute TTL) are never read again.
const CACHE_PREFIX = "org-config:v2";
function isCacheDisabled() {
  return (
    process.env.NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED === "true" ||
    process.env.NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED === "1"
  );
}

function buildStateKey(keys: readonly string[], slug?: string) {
  const normalizedKeys = [...keys].sort().join(",");
  return `${CACHE_PREFIX}:${slug ?? "unknown"}:${normalizedKeys}`;
}

function buildCacheKey(key: string, slug?: string) {
  return `${CACHE_PREFIX}:${slug ?? "unknown"}:${key}`;
}

function readCache(
  cacheKey: string,
): { timestamp: number; value: string } | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; value: string };
    if (!parsed?.timestamp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({ timestamp: Date.now(), value }),
    );
  } catch {
    return;
  }
}

export default function useOrganizationConfig<K extends readonly string[]>(
  keys: K,
): ConfigResult<K> & { status: ConfigStatus } {
  const [state, setState] = useState<ConfigState<K>>(() => ({
    stateKey: "",
    data: {},
    status: "ok",
  }));
  const { organization } = useActiveOrganization();

  useEffect(() => {
    let cancelled = false;
    const host =
      typeof window === "undefined" ? undefined : window.location.host;
    const slug = organization?.data?.slug ?? getSlugFromHost(host ?? undefined);
    const stateKey = buildStateKey(keys, slug);
    const now = Date.now();
    const cachedData: ConfigResult<K> = {};
    const missingKeys = new Set<string>();

    keys.forEach((key) => {
      if (isCacheDisabled()) {
        missingKeys.add(key);
        return;
      }

      const cacheKey = buildCacheKey(key, slug);
      const cached = readCache(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        cachedData[key as K[number]] = cached.value;
      } else {
        missingKeys.add(key);
      }
    });

    Promise.resolve().then(() => {
      if (cancelled) return;
      setState({ stateKey, data: cachedData, status: "ok" });
    });

    if (missingKeys.size === 0)
      return () => {
        cancelled = true;
      };

    const missingKeysArray = Array.from(missingKeys);

    api.organizationConfig
      .$get({
        query: {
          keys: missingKeysArray,
          organizationSlug: slug,
        },
      })
      .then(async (res: Response) => {
        if (cancelled) return;

        // Check before parsing: a non-ok body is an error payload, not config.
        if (!res.ok) {
          setState({
            stateKey,
            data: cachedData,
            status: res.status === 404 ? "not-found" : "error",
          });
          return;
        }

        const responseData = (await res.json()) as ConfigResult<K>;
        if (cancelled) return;
        const mergedData = { ...cachedData, ...responseData };
        setState({ stateKey, data: mergedData, status: "ok" });
        if (isCacheDisabled()) return;
        Object.entries(responseData).forEach(([key, value]) => {
          if (typeof value !== "string") return;
          const cacheKey = buildCacheKey(key, slug);
          writeCache(cacheKey, value);
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ stateKey, data: cachedData, status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [organization?.data?.slug, ...keys]); // eslint-disable-line react-hooks/exhaustive-deps

  const host = typeof window === "undefined" ? undefined : window.location.host;
  const slug = organization?.data?.slug ?? getSlugFromHost(host ?? undefined);
  const stateKey = buildStateKey(keys, slug);

  if (state.stateKey !== stateKey)
    return { status: "ok" } as ConfigResult<K> & { status: ConfigStatus };

  return { ...state.data, status: state.status };
}
