import type { DashboardResponse, HealthResponse } from "./types";

const DEFAULT_BASE_URL = "https://gridbricks-sc0p.onrender.com/api";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL
).replace(/\/+$/, "");

/** The backend rejects larger values with HTTP 400. */
export const MAX_ROW_LIMIT = 1000;

// Render's free tier can take ~50s to wake a sleeping service.
const REQUEST_TIMEOUT_MS = 90_000;

export class ApiError extends Error {
  readonly status: number | null;
  readonly kind: "http" | "network" | "timeout" | "parse";

  constructor(
    message: string,
    kind: ApiError["kind"],
    status: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

// Identical requests already in flight share one fetch, so React StrictMode's
// double-mounted effects (and quick re-renders) never fire or cancel duplicates.
const inflight = new Map<string, Promise<unknown>>();

function request<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, String(value)),
  );

  const key = url.toString();
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetchJson<T>(url).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function fetchJson<T>(url: URL): Promise<T> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: timeout.signal,
      });
    } catch {
      if (timeout.signal.aborted) {
        throw new ApiError(
          "The backend did not respond in time. It may still be waking up — please retry.",
          "timeout",
        );
      }
      throw new ApiError(
        "Could not reach the backend. Check your connection or try again shortly.",
        "network",
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError(
        `Unexpected response from the backend (HTTP ${response.status}).`,
        "parse",
        response.status,
      );
    }

    if (!response.ok) {
      const detail =
        (body as { error?: string; detail?: string } | null)?.error ??
        (body as { detail?: string } | null)?.detail;
      throw new ApiError(
        detail || `Request failed with HTTP ${response.status}.`,
        "http",
        response.status,
      );
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export function getHealth() {
  return request<HealthResponse>("/health/");
}

export function getDashboard(month: string, limit: number = MAX_ROW_LIMIT) {
  return request<DashboardResponse>("/dashboard/", { month, limit });
}
