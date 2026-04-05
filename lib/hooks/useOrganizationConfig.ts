"use client";

import { useEffect, useState } from "react";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import api from "@/lib/api";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

type ConfigResult<K extends readonly string[]> = Partial<
  Record<K[number], string>
>;

type ConfigState<K extends readonly string[]> = {
  stateKey: string;
  data: ConfigResult<K>;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
function isCacheDisabled() {
  return (
    process.env.NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED === "true" ||
    process.env.NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED === "1"
  );
}

function buildStateKey(keys: readonly string[], slug?: string) {
  const normalizedKeys = [...keys].sort().join(",");
  return `org-config:${slug ?? "unknown"}:${normalizedKeys}`;
}

function buildCacheKey(key: string, slug?: string) {
  return `org-config:${slug ?? "unknown"}:${key}`;
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
): ConfigResult<K> {
  const [state, setState] = useState<ConfigState<K>>(() => ({
    stateKey: "",
    data: {},
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
      setState({ stateKey, data: cachedData });
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
      .then((res: Response) => res.json() as Promise<ConfigResult<K>>)
      .then((responseData: ConfigResult<K>) => {
        if (cancelled) return;
        const mergedData = { ...cachedData, ...responseData };
        setState({ stateKey, data: mergedData });
        if (isCacheDisabled()) return;
        Object.entries(responseData).forEach(([key, value]) => {
          if (typeof value !== "string") return;
          const cacheKey = buildCacheKey(key, slug);
          writeCache(cacheKey, value);
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ stateKey, data: cachedData });
      });

    return () => {
      cancelled = true;
    };
  }, [organization?.data?.slug, ...keys]); // eslint-disable-line react-hooks/exhaustive-deps

  const host = typeof window === "undefined" ? undefined : window.location.host;
  const slug = organization?.data?.slug ?? getSlugFromHost(host ?? undefined);
  const stateKey = buildStateKey(keys, slug);

  if (state.stateKey !== stateKey) return {} as ConfigResult<K>;

  return state.data;
}
