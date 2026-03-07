# Query & API Client

`lib/query.ts` exposes a single typed client, `q`, for both client and server React Query usage.
It's based off the TRPC api, but works with Hono RPC.

You use it very similarly to Hono's RPC client, but directly inside of React Query.

e.g. instead of

```tsx
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const notificationQuery = useQuery({
  queryKey: ["notifications", { page: "1", pageSize: "20" }],
  queryFn: async () => {
    const res = await api.notifications.$get({
      query: { page: "1", pageSize: "20" },
    });
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return res.json();
  },
});
```

you can just do:

```tsx
import { q } from "@/lib/query";
import { useQuery } from "@tanstack/react-query";

const notificationQuery = useQuery(
  q.notifications.$get.queryOptions({
    query: { page: "1", pageSize: "20" },
  }),
);
```

and it keeps the same type-safety and autocomplete as Hono RPC.

## API surface

- `.$get.queryOptions(input?, options?)`
- `.$get.queryKey(input?)`
- `.$post|$patch|$delete.mutationOptions(options?)`
- `.pathKey()`

## usage

1. In a **Server Component**, start prefetch and do not await it.

```tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/queryClient";
import { q } from "@/lib/query";
import NotificationsClient from "./NotificationsClient";

export default function Page() {
  const queryClient = getQueryClient();

  queryClient.prefetchQuery(
    q.notifications.$get.queryOptions({
      query: { page: "1", pageSize: "20" },
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NotificationsClient />
    </HydrationBoundary>
  );
}
```

2. In a **Client Component**, read the same query with `useSuspenseQuery`.

```tsx
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { q } from "@/lib/query";

export default function NotificationsClient() {
  const { data } = useSuspenseQuery(
    q.notifications.$get.queryOptions({
      query: { page: "1", pageSize: "20" },
    }),
  );

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

What happens here:

- The server starts the query first (by directly passing the request to Hono, with no network hop).
- On the client, `useSuspenseQuery(...)` picks up same prefetch, and suspends the component until the query resolves.
- you can then use `<Suspense fallback={<LoadingSkeleton />}>` to show a loading state, just like you would with any other query, while still getting all the other react-query benefits.
