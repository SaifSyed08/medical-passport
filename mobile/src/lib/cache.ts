// In-memory cache of API responses. Patient data never touches disk and is wiped on sign-out.
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

const store = new Map<string, unknown>();
const listeners = new Set<() => void>();

export function clearCache() {
  store.clear();
  listeners.forEach(l => l());
}
export function primeCache<T>(path: string, value: T) {
  store.set(path, value);
  listeners.forEach(l => l());
}

export type Resource<T> = {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  /** True when showing cached data because the network failed. */
  stale: boolean;
  refresh: () => Promise<void>;
};

/** Loads `path` on mount and whenever the screen regains focus. Keeps the last good value offline. */
export function useResource<T>(path: string | null): Resource<T> {
  const [, force] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => {
      live.current = false;
      listeners.delete(l);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const v = await api<T>(path);
      store.set(path, v);
      if (live.current) setError(null);
      listeners.forEach(l => l());
    } catch (e) {
      if (live.current) setError(e instanceof ApiError ? e : new ApiError(0, String(e)));
    } finally {
      if (live.current) setLoading(false);
    }
  }, [path]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const data = path ? (store.get(path) as T | undefined) : undefined;
  return { data, error, loading, stale: !!error && data !== undefined, refresh };
}
