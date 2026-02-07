"use client";
import { useEffect, useState } from "react";

type ConfigResult<K extends readonly string[]> = Partial<
  Record<K[number], string>
>;

function getSlugFromLocation(): string {
  if (typeof window === "undefined") return "servicestart";
  const host = window.location.host.toLowerCase();
  const match = host.match(/^([a-z0-9-]+)\.servicestart\.com$/);
  return match ? match[1] : "servicestart";
}

export default function useOrganizationConfig<K extends readonly string[]>(
  keys: K,
) {
  const [data, setData] = useState<ConfigResult<K>>({});

  useEffect(() => {
    const slug = getSlugFromLocation();
    const params = new URLSearchParams();
    if (keys.length > 0) {
      params.set("keys", keys.join(","));
    }
    params.set("organizationSlug", slug);

    const url = `/api/organizationconfig?${params.toString()}`;

    (async () => {
      try {
        const res = await fetch(url);
        const json = await res.json();
        setData(json);
      } catch {
        return;
      }
    })();
  }, [keys]);

  return data;
}
