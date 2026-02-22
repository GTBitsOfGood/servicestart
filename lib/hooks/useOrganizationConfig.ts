"use client";
import { useEffect, useState } from "react";
import { getSlugFromHost } from "@/lib/clientAuthUtils";

type ConfigResult<K extends readonly string[]> = Partial<
  Record<K[number], string>
>;

export default function useOrganizationConfig<K extends readonly string[]>(
  keys: K,
) {
  const [data, setData] = useState<ConfigResult<K>>({});

  useEffect(() => {
    const host =
      typeof window === "undefined" ? undefined : window.location.host;
    const slug = getSlugFromHost(host);
    const params = new URLSearchParams();
    if (keys.length > 0) {
      params.set("keys", keys.join(","));
    }
    params.set("organizationSlug", slug);

    const url = `/api/organizationconfig?${params.toString()}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Request failed");
        return res.json();
      })
      .then(setData)
      .catch(() => {});
  }, [keys]);

  return data;
}
