import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiUrl, USE_REAL_API } from "./api";
import { getAuthToken, dispatch401 } from "./auth";
import { mockFetch, isApiUrl } from "./mockApi";

async function throwIfResNotOk(res: Response, skip401Dispatch?: boolean) {
  if (res.status === 401 && USE_REAL_API && !skip401Dispatch) {
    dispatch401();
  }
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function buildHeaders(hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {};
  if (hasBody) headers["Content-Type"] = "application/json";
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function request(url: string, options?: { method?: string; body?: string }) {
  const path = url.startsWith("/") ? url : `/${url}`;
  if (isApiUrl(path)) {
    if (USE_REAL_API) {
      return fetch(apiUrl(path), {
        method: options?.method ?? "GET",
        headers: buildHeaders(!!options?.body),
        body: options?.body,
        credentials: "include",
      });
    }
    return mockFetch(path, { method: options?.method, body: options?.body, credentials: "include" });
  }
  return fetch(url, {
    method: options?.method,
    headers: options?.body ? { "Content-Type": "application/json" } : {},
    body: options?.body,
    credentials: "include",
  });
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await request(url, {
    method,
    body: data ? JSON.stringify(data) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await request(url);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
