"use client";

import { useEffect, useState } from "react";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import api from "@/lib/api";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

type ConfigResult<K extends readonly string[]> = Partial<
  Record<K[number], string>
>;

type ConfigState<K extends readonly string[]> = {
  cacheKey: string;
  data: ConfigResult<K>;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
function isCacheDisabled() {
  return (
    process.env.NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED === "true" ||
    process.env.NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED === "1"
  );
}

function buildCacheKey(keys: readonly string[], slug?: string) {
  const normalizedKeys = [...keys].sort().join(",");
  return `org-config:${slug ?? "unknown"}:${normalizedKeys}`;
}

function readCache<K extends readonly string[]>(
  cacheKey: string,
): { timestamp: number; data: ConfigResult<K> } | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      timestamp: number;
      data: ConfigResult<K>;
    };
    if (!parsed?.timestamp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache<K extends readonly string[]>(
  cacheKey: string,
  data: ConfigResult<K>,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({ timestamp: Date.now(), data }),
    );
  } catch {
    return;
  }
}

export default function useOrganizationConfig<K extends string[]>(keys: K) {
  const [state, setState] = useState<ConfigState<K>>(() => ({
    cacheKey: "",
    data: {},
  }));
  const { organization } = useActiveOrganization();

  useEffect(() => {
    const host =
      typeof window === "undefined" ? undefined : window.location.host;
    const slug = organization?.data?.slug ?? getSlugFromHost(host ?? undefined);
    const cacheKey = buildCacheKey(keys, slug);
    const cached = !isCacheDisabled() ? readCache<K>(cacheKey) : null;
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      Promise.resolve().then(() => {
        setState({ cacheKey, data: cached.data ?? {} });
      });
      return;
    }

    api.organizationConfig
      .$get({
        query: {
          keys: keys as string[],
          organizationSlug: slug,
        },
      })
      .then((res: Response) => res.json() as Promise<ConfigResult<K>>)
      .then((responseData: ConfigResult<K>) => {
        setState({ cacheKey, data: responseData });
        if (!isCacheDisabled()) {
          writeCache<K>(cacheKey, responseData);
        }
      })
      .catch(() => setState({ cacheKey, data: {} }));
  }, [organization?.data?.slug, ...keys]); // eslint-disable-line react-hooks/exhaustive-deps

  const host = typeof window === "undefined" ? undefined : window.location.host;
  const slug = organization?.data?.slug ?? getSlugFromHost(host ?? undefined);
  const cacheKey = buildCacheKey(keys, slug);

  if (state.cacheKey !== cacheKey) return {};

  return state.data;
}
