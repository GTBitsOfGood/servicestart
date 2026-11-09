"use client";

import { useEffect, useState } from "react";
import { getSlugFromHost } from "@/core/tenant/clientAuthUtils";
import api from "@/core/api/client";
import { useActiveOrganization } from "@/core/tenant/hooks/useActiveOrganization";
import { decodeConfigValue } from "@/core/config/defineConfig";
import {
  type ConfigValue,
  type ConfigValues,
  getConfigDefinition,
} from "@/core/config/registry";
import type { OrganizationConfigKey } from "@/core/config/schema";

// Keys still loading, and keys the caller may not read, are missing.
type ConfigResult<K extends OrganizationConfigKey> = Partial<ConfigValues<K>>;

export type ConfigStatus = "ok" | "not-found" | "error";

type ConfigState<K extends OrganizationConfigKey> = {
  stateKey: string;
  data: ConfigResult<K>;
  status: ConfigStatus;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
// v3: values are typed (booleans, objects), no longer only strings.
const CACHE_PREFIX = "org-config:v3";
function isCacheDisabled() {
  return (
    process.env.NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED === "true" ||
    process.env.NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED === "1"
  );
}

// The cache is per browser and per org, not per user, so a restricted value
// cached for an admin could be read by whoever signs in next.
function isCacheable(key: OrganizationConfigKey) {
  return !isCacheDisabled() && getConfigDefinition(key).visibility === "public";
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
): { timestamp: number; value: unknown } | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; value: unknown };
    if (!parsed?.timestamp || !("value" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, value: unknown) {
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

/** A value from the server or the cache, checked with its key's schema. */
function parseValue<P extends OrganizationConfigKey>(
  key: P,
  value: unknown,
): ConfigValue<P> {
  const definition = getConfigDefinition(key);
  const result = decodeConfigValue(definition, value);
  return result.success ? result.data : definition.default;
}

export default function useOrganizationConfig<
  const K extends OrganizationConfigKey,
>(keys: readonly K[]): ConfigResult<K> & { status: ConfigStatus } {
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
    const missingKeys = new Set<K>();

    keys.forEach((key) => {
      if (!isCacheable(key)) {
        missingKeys.add(key);
        return;
      }

      const cached = readCache(buildCacheKey(key, slug));
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        cachedData[key] = parseValue(key, cached.value);
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

        const body = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;
        const responseData: ConfigResult<K> = {};
        for (const key of missingKeysArray) {
          // The server leaves out keys this caller may not read.
          if (!Object.hasOwn(body, key)) continue;
          responseData[key] = parseValue(key, body[key]);
        }
        setState({
          stateKey,
          data: { ...cachedData, ...responseData },
          status: "ok",
        });
        for (const key of missingKeysArray) {
          if (isCacheable(key) && Object.hasOwn(responseData, key)) {
            writeCache(buildCacheKey(key, slug), responseData[key]);
          }
        }
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
