import { afterEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

async function loadQueryModule() {
  vi.resetModules();
  return import("@/lib/query");
}

type QueryFnLike<TData> = {
  queryFn: (context: { signal?: AbortSignal }) => Promise<TData>;
};

type MutationFnLike<TData, TVariables> = {
  mutationKey?: readonly unknown[];
  mutationFn: (variables: TVariables) => Promise<TData>;
};

describe("query layer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds query keys and path keys", async () => {
    const { q } = await loadQueryModule();

    const input = {
      query: {
        page: "1",
        pageSize: "5",
      },
    };

    expect(q.notifications.$get.queryKey(input)).toEqual([
      "q",
      "notifications",
      "$get",
      input,
    ]);
    expect(q.notifications.$get.pathKey()).toEqual(["q", "notifications"]);
    expect(q.notifications[":id"].$patch.pathKey()).toEqual([
      "q",
      "notifications",
      ":id",
    ]);

    const getNode = q.notifications.$get as unknown as Record<string, unknown>;
    const patchNode = q.notifications[":id"].$patch as unknown as Record<
      string,
      unknown
    >;

    expect(getNode.useQueryOptions).toBeUndefined();
    expect(getNode.call).toBeUndefined();
    expect(patchNode.useMutationOptions).toBeUndefined();
    expect(patchNode.call).toBeUndefined();
  });

  it("queryOptions forwards signal and request init", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ data: [], page: 1, pageSize: 5 }));

    const { q } = await loadQueryModule();

    const signal = new AbortController().signal;
    const query = q.notifications.$get.queryOptions(
      {
        query: {
          page: "1",
          pageSize: "5",
        },
      },
      {
        request: {
          init: {
            headers: {
              "x-test-header": "works",
            },
          },
        },
      },
    );

    const typedQuery = query as unknown as QueryFnLike<{
      data: unknown[];
      page: number;
      pageSize: number;
    }>;

    const data = await typedQuery.queryFn({ signal });

    expect(data).toEqual({ data: [], page: 1, pageSize: 5 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [, init] = fetchSpy.mock.calls[0];
    const headers = new Headers((init as RequestInit | undefined)?.headers);

    expect((init as RequestInit | undefined)?.credentials).toBe("include");
    expect((init as RequestInit | undefined)?.signal).toBe(signal);
    expect(headers.get("x-test-header")).toBe("works");
  });

  it("mutationOptions executes request and uses path mutation key", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ id: "n1", read: true }));

    const { q } = await loadQueryModule();

    const mutation = q.notifications[":id"].$patch.mutationOptions();
    const typedMutation = mutation as unknown as MutationFnLike<
      { id: string; read: boolean },
      { param: { id: string }; json: { read: boolean } }
    >;

    expect(typedMutation.mutationKey).toEqual(["q", "notifications", ":id"]);

    const data = await typedMutation.mutationFn({
      param: { id: "n1" },
      json: { read: true },
    });

    expect(data).toEqual({ id: "n1", read: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/api/notifications/n1");
    expect((init as RequestInit | undefined)?.method).toBe("PATCH");
  });

  it("throws QRequestError with parsed details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "No active organization" }, 400),
    );

    const { q, QRequestError } = await loadQueryModule();

    const query = q.notifications.$get.queryOptions({
      query: {
        page: "1",
        pageSize: "5",
      },
    });
    const typedQuery = query as unknown as QueryFnLike<unknown>;

    const promise = typedQuery.queryFn({});

    await expect(promise).rejects.toBeInstanceOf(QRequestError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      method: "GET",
      endpoint: "/api/notifications",
    });
    await expect(promise).rejects.toThrow("No active organization");
  });

  it("uses registered server fetch override when window is undefined", async () => {
    const browserFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ data: [], page: 1, pageSize: 5 }));

    const { q, registerQueryServerFetch } = await loadQueryModule();

    const serverFetch = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(jsonResponse({ data: [], page: 1, pageSize: 5 }));

    registerQueryServerFetch(serverFetch);
    vi.stubGlobal("window", undefined);

    const query = q.notifications.$get.queryOptions({
      query: {
        page: "1",
        pageSize: "5",
      },
    });
    const typedQuery = query as unknown as QueryFnLike<{
      data: unknown[];
      page: number;
      pageSize: number;
    }>;
    const data = await typedQuery.queryFn({});

    expect(data).toEqual({ data: [], page: 1, pageSize: 5 });
    expect(serverFetch).toHaveBeenCalledTimes(1);
    expect(browserFetch).not.toHaveBeenCalled();
  });
});
