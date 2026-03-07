import {
  mutationOptions,
  queryOptions,
  type MutationOptions,
  type UnusedSkipTokenOptions,
} from "@tanstack/react-query";
import type { AppType } from "@/lib/app";
import { getBaseUrl } from "@/lib/clientUtils";
import { hc, type InferResponseType } from "hono/client";

const QUERY_KEY_ROOT = "q";
const QUERY_METHOD = "$get";

type SuccessStatusCodes =
  | 200
  | 201
  | 202
  | 203
  | 204
  | 205
  | 206
  | 207
  | 208
  | 226;

type ApiClient = ReturnType<typeof hc<AppType>>["api"];
type AnyRequestOptions = {
  init?: RequestInit;
  [key: string]: unknown;
};
type AnyMethod = (...args: never[]) => Promise<unknown>;
type RuntimeMethod = (
  input?: unknown,
  requestOptions?: AnyRequestOptions,
) => Promise<Response>;

type MethodInput<TMethod extends AnyMethod> = Parameters<TMethod>[0];
type MethodRequestOptions<TMethod extends AnyMethod> = Parameters<TMethod>[1];
type MethodSuccessData<TMethod extends AnyMethod> = InferResponseType<
  TMethod,
  SuccessStatusCodes
>;

type QPathKey<TPath extends readonly string[]> = readonly [
  typeof QUERY_KEY_ROOT,
  ...TPath,
];
type QQueryKey<TPath extends readonly string[], TInput> = readonly [
  typeof QUERY_KEY_ROOT,
  ...TPath,
  TInput,
];
type DropLast<T extends readonly unknown[]> = T extends [...infer Rest, unknown]
  ? Rest
  : [];

type QueryFactoryOptions<
  TMethod extends AnyMethod,
  TPath extends readonly string[],
> = Omit<
  UnusedSkipTokenOptions<
    MethodSuccessData<TMethod>,
    QRequestError,
    MethodSuccessData<TMethod>,
    QQueryKey<TPath, MethodInput<TMethod>>
  >,
  "queryKey" | "queryFn"
> & {
  request?: MethodRequestOptions<TMethod>;
};

type MethodQueryKeyArgs<TMethod extends AnyMethod> =
  undefined extends MethodInput<TMethod>
    ? [input?: MethodInput<TMethod>]
    : [input: MethodInput<TMethod>];

type MethodQueryOptionsArgs<
  TMethod extends AnyMethod,
  TPath extends readonly string[],
> =
  undefined extends MethodInput<TMethod>
    ? [
        input?: MethodInput<TMethod>,
        options?: QueryFactoryOptions<TMethod, TPath>,
      ]
    : [
        input: MethodInput<TMethod>,
        options?: QueryFactoryOptions<TMethod, TPath>,
      ];

type MutationFactoryOptions<
  TMethod extends AnyMethod,
  TContext = unknown,
> = Omit<
  MutationOptions<
    MethodSuccessData<TMethod>,
    QRequestError,
    MethodInput<TMethod>,
    TContext
  >,
  "mutationFn"
> & {
  request?: MethodRequestOptions<TMethod>;
};

type BuiltQueryOptions<
  TMethod extends AnyMethod,
  TPath extends readonly string[],
> = UnusedSkipTokenOptions<
  MethodSuccessData<TMethod>,
  QRequestError,
  MethodSuccessData<TMethod>,
  QQueryKey<TPath, MethodInput<TMethod>>
> & {
  queryKey: QQueryKey<TPath, MethodInput<TMethod>>;
};

type BuiltMutationOptions<
  TMethod extends AnyMethod,
  TContext = unknown,
> = ReturnType<
  typeof mutationOptions<
    MethodSuccessData<TMethod>,
    QRequestError,
    MethodInput<TMethod>,
    TContext
  >
>;

type QueryMethodNode<
  TMethod extends AnyMethod,
  TPath extends readonly string[],
> = {
  pathKey: () => QPathKey<DropLast<TPath>>;
  queryKey: (
    ...args: MethodQueryKeyArgs<TMethod>
  ) => QQueryKey<TPath, MethodInput<TMethod>>;
  queryOptions: (
    ...args: MethodQueryOptionsArgs<TMethod, TPath>
  ) => BuiltQueryOptions<TMethod, TPath>;
};

type MutationMethodNode<
  TMethod extends AnyMethod,
  TPath extends readonly string[],
> = {
  pathKey: () => QPathKey<DropLast<TPath>>;
  mutationOptions: <TContext = unknown>(
    options?: MutationFactoryOptions<TMethod, TContext>,
  ) => BuiltMutationOptions<TMethod, TContext>;
};

type MethodNode<
  TKey extends string,
  TMethod extends AnyMethod,
  TPath extends readonly string[],
> = TKey extends "$get"
  ? QueryMethodNode<TMethod, TPath>
  : MutationMethodNode<TMethod, TPath>;

type QPathNode<TNode, TPath extends readonly string[] = []> = {
  pathKey: () => QPathKey<TPath>;
} & {
  [K in keyof TNode as K extends string ? K : never]: TNode[K] extends AnyMethod
    ? MethodNode<K & string, TNode[K], [...TPath, K & string]>
    : TNode[K] extends (...args: never[]) => unknown
      ? never
      : TNode[K] extends Record<string, unknown>
        ? QPathNode<TNode[K], [...TPath, K & string]>
        : never;
};

export type Q = QPathNode<ApiClient>;

type QFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

let serverFetchOverride: QFetch | undefined;

export function registerQueryServerFetch(fetchImpl: QFetch) {
  serverFetchOverride = fetchImpl;
}

function isServerRuntime() {
  return typeof window === "undefined";
}

const runtimeFetch: typeof fetch = async (input, init) =>
  isServerRuntime() && serverFetchOverride
    ? serverFetchOverride(input, init)
    : fetch(input, {
        credentials: "include",
        ...init,
      });

const client = hc<AppType>(getBaseUrl(), {
  fetch: runtimeFetch,
  init: {
    credentials: "include",
  },
});

const api = client.api as Record<string, unknown>;

export class QRequestError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly method: string;
  readonly endpoint: string;
  readonly detail: unknown;
  readonly input: unknown;

  constructor(options: {
    status: number;
    statusText: string;
    method: string;
    endpoint: string;
    detail: unknown;
    input: unknown;
  }) {
    const detailMessage = getDetailMessage(options.detail);
    const message = detailMessage
      ? `${options.method} ${options.endpoint} failed (${options.status} ${options.statusText}): ${detailMessage}`
      : `${options.method} ${options.endpoint} failed (${options.status} ${options.statusText})`;

    super(message);
    this.name = "QRequestError";
    this.status = options.status;
    this.statusText = options.statusText;
    this.method = options.method;
    this.endpoint = options.endpoint;
    this.detail = options.detail;
    this.input = options.input;
  }
}

type AnyQueryFactoryOptions = {
  request?: AnyRequestOptions;
  [key: string]: unknown;
};

type AnyMutationFactoryOptions = {
  request?: AnyRequestOptions;
  [key: string]: unknown;
};

function isMethodPath(path: readonly string[]): boolean {
  if (path.length === 0) return false;
  return path[path.length - 1].startsWith("$");
}

function buildPathKey(path: readonly string[]) {
  const normalizedPath = isMethodPath(path) ? path.slice(0, -1) : path;
  return [QUERY_KEY_ROOT, ...normalizedPath] as const;
}

function buildQueryKey(path: readonly string[], input: unknown) {
  return [QUERY_KEY_ROOT, ...path, input] as const;
}

function methodFromPath(path: readonly string[]) {
  if (!isMethodPath(path)) {
    throw new Error(
      "Query method utilities can only be used at endpoint methods",
    );
  }
  return path[path.length - 1].slice(1).toUpperCase();
}

function endpointFromPath(path: readonly string[]) {
  const routePath = isMethodPath(path) ? path.slice(0, -1) : path;
  const joined = routePath.join("/");
  return joined.length > 0 ? `/api/${joined}` : "/api";
}

function mergeRequestOptionsWithSignal(
  requestOptions: AnyRequestOptions | undefined,
  signal: AbortSignal | undefined,
): AnyRequestOptions | undefined {
  if (!signal) return requestOptions;

  const nextInit = {
    ...(requestOptions?.init ?? {}),
  };

  if (!nextInit.signal) {
    nextInit.signal = signal;
  }

  return {
    ...(requestOptions ?? {}),
    init: nextInit,
  };
}

function getApiMethod(path: readonly string[]): RuntimeMethod {
  if (!isMethodPath(path)) {
    throw new Error("Expected an endpoint method path");
  }

  let current: unknown = api;
  for (const segment of path.slice(0, -1)) {
    current = (current as Record<string, unknown>)[segment];
  }

  const method = (current as Record<string, unknown>)[path[path.length - 1]];

  if (typeof method !== "function") {
    throw new Error(`No API method found for path ${path.join(".")}`);
  }

  return method as RuntimeMethod;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (
    response.status === 204 ||
    response.status === 205 ||
    response.status === 304
  ) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function parseErrorDetail(response: Response): Promise<unknown> {
  const clone = response.clone();

  try {
    return await parseResponseBody(clone);
  } catch {
    return undefined;
  }
}

function getDetailMessage(detail: unknown): string | undefined {
  if (detail == null) return undefined;

  if (typeof detail === "string") {
    const text = detail.trim();
    return text.length > 0 ? truncate(text, 240) : undefined;
  }

  if (typeof detail === "object") {
    const maybeMessage =
      (detail as Record<string, unknown>).message ??
      (detail as Record<string, unknown>).error;

    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return truncate(maybeMessage.trim(), 240);
    }

    try {
      return truncate(JSON.stringify(detail), 240);
    } catch {
      return "[unserializable error body]";
    }
  }

  return truncate(String(detail), 240);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

async function executeMethod(
  path: readonly string[],
  input: unknown,
  requestOptions?: AnyRequestOptions,
  signal?: AbortSignal,
) {
  const method = getApiMethod(path);
  const mergedRequestOptions = mergeRequestOptionsWithSignal(
    requestOptions,
    signal,
  );

  const response = await method(input, mergedRequestOptions);

  if (!response.ok) {
    throw new QRequestError({
      status: response.status,
      statusText: response.statusText,
      method: methodFromPath(path),
      endpoint: endpointFromPath(path),
      detail: await parseErrorDetail(response),
      input,
    });
  }

  return parseResponseBody(response);
}

function buildQueryOptionsAtPath(
  path: readonly string[],
  input: unknown,
  options?: AnyQueryFactoryOptions,
) {
  const { request, ...reactQueryOptions } = options ?? {};

  return queryOptions({
    ...(reactQueryOptions as object),
    queryKey: buildQueryKey(path, input),
    queryFn: ({ signal }) => executeMethod(path, input, request, signal),
  });
}

function buildMutationOptionsAtPath(
  path: readonly string[],
  options?: AnyMutationFactoryOptions,
) {
  const { request, ...reactMutationOptions } = options ?? {};

  const mutationOptionsWithDefaults = {
    ...(reactMutationOptions as object),
    mutationKey:
      (reactMutationOptions as { mutationKey?: readonly unknown[] })
        .mutationKey ?? buildPathKey(path),
    mutationFn: (input: unknown) => executeMethod(path, input, request),
  };

  return mutationOptions(mutationOptionsWithDefaults);
}

function createQProxy(path: string[]): unknown {
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key !== "string" || key === "then") {
          return undefined;
        }

        if (key === "pathKey") {
          return () => buildPathKey(path);
        }

        if (!isMethodPath(path)) {
          return createQProxy([...path, key]);
        }

        const method = path[path.length - 1];

        if (method === QUERY_METHOD) {
          if (key === "queryKey") {
            return (input?: unknown) => buildQueryKey(path, input);
          }

          if (key === "queryOptions") {
            return (input?: unknown, options?: AnyQueryFactoryOptions) =>
              buildQueryOptionsAtPath(path, input, options);
          }
        }

        if (method !== QUERY_METHOD && key === "mutationOptions") {
          return (options?: AnyMutationFactoryOptions) =>
            buildMutationOptionsAtPath(path, options);
        }

        return undefined;
      },
    },
  );
}

export const q = createQProxy([]) as Q;
