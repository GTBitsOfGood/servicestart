"use client";

import { useEffect, useState } from "react";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import api from "@/lib/api";

type ConfigResult<K extends readonly string[]> = Partial<
  Record<K[number], string>
>;
export default function useOrganizationConfig<K extends string[]>(keys: K) {
  const [data, setData] = useState<ConfigResult<K>>({});
  const keyString = keys.join(",");

  useEffect(() => {
    const host =
      typeof window === "undefined" ? undefined : window.location.host;
    const slug = getSlugFromHost(host);

    api.organizationConfig
      .$get({
        query: {
          keys: keys as string[],
          organizationSlug: slug,
        },
      })
      .then((res) => res.json())
      .then(setData);
  }, keys);

  return data;
}
