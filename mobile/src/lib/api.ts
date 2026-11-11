// Client for the Tessera Workers API (/api/v1). Bearer token only; no cookies.
import type { ApiError as ApiErrorBody } from "@shared/tessera";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
  }
  get offline() {
    return this.code === "offline";
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;
export const setToken = (t: string | null) => (token = t);
export const getToken = () => token;
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);
export const authHeader = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

type Init = { method?: string; body?: unknown; form?: FormData; timeoutMs?: number };

export async function api<T>(path: string, init: Init = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, "API URL not configured", "config");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 15000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method: init.method ?? (init.body || init.form ? "POST" : "GET"),
      headers: { ...authHeader(), ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "Network unavailable", "offline");
  } finally {
    clearTimeout(timer);
  }
  const data = (await res.json().catch(() => ({}))) as T & Partial<ApiErrorBody>;
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, data.error ?? "Request failed", data.code);
  }
  return data;
}
