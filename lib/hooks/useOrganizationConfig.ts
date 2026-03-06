"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import api from "@/lib/api";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

type ConfigResult<K extends readonly string[]> = Partial<
  Record<K[number], string>
>;

export default function useOrganizationConfig<K extends string[]>(keys: K) {
  const [data, setData] = useState<ConfigResult<K>>({});
  const { organization } = useActiveOrganization();
  const searchParams = useSearchParams();
  const urlOrg = searchParams.get("org");

  useEffect(() => {
    const host =
      typeof window === "undefined" ? undefined : window.location.host;
    const slug =
      urlOrg ?? organization?.data?.slug ?? getSlugFromHost(host ?? undefined);

    api.organizationConfig
      .$get({
        query: {
          keys: keys as string[],
          organizationSlug: slug,
        },
      })
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData({}));
  }, [urlOrg, organization?.data?.slug, ...keys]); // eslint-disable-line react-hooks/exhaustive-deps

  return data;
}
