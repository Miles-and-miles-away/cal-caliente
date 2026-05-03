import { useEffect, useState } from "react";
import { getCache, setCache } from "@/lib/cache";

// Wraps a tRPC/React-Query result so that:
//   - On mount, cached data is shown while the live query is in-flight
//   - On successful fetch, fresh data is written back to the cache
//   - When the live query is offline/erroring, the last-known-good cached
//     data continues to be visible (with `isCached: true` so the UI can flag it)
//
// We intentionally don't reach into the React Query cache directly. AsyncStorage
// gives us cross-session persistence; React Query's in-memory cache only
// survives until the app is killed.

interface QueryShape<T> {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
}

export interface CachedQueryResult<T> {
  /** Best-available data: live if present, otherwise cached, otherwise null. */
  data: T | null;
  /** True only when both the network is loading AND no cached fallback exists. */
  isLoading: boolean;
  /** True when the user is seeing cached data because the live query hasn't returned yet. */
  isCached: boolean;
  error: unknown;
}

export function useCachedQuery<T>(
  query: QueryShape<T>,
  cacheKey: string,
  ttlMs: number,
): CachedQueryResult<T> {
  const [cached, setCached] = useState<T | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  // Load from cache on mount and whenever the key changes (e.g. month nav).
  useEffect(() => {
    let cancelled = false;
    setCacheLoaded(false);
    getCache<T>(cacheKey, { validateTTL: true }).then((value) => {
      if (cancelled) return;
      setCached(value);
      setCacheLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  // Persist fresh data to AsyncStorage as soon as it arrives. Skip empty arrays —
  // an empty result on first load is more likely "no events found" than something
  // worth caching, and an offline/errored fetch shouldn't overwrite useful cache.
  useEffect(() => {
    if (query.data === undefined) return;
    if (Array.isArray(query.data) && query.data.length === 0) return;
    setCache(cacheKey, query.data, ttlMs);
  }, [query.data, cacheKey, ttlMs]);

  const data = (query.data ?? cached) as T | null;
  const isCached = query.data === undefined && cached !== null;
  // Only show a true loading state when we have nothing to render at all.
  const isLoading = query.isLoading && !cacheLoaded;

  return { data, isLoading, isCached, error: query.error };
}
