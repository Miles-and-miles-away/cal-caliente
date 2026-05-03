// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock AsyncStorage before importing anything that touches it.
const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      store.delete(k);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k);
    }),
    getAllKeys: vi.fn(async () => Array.from(store.keys())),
  },
}));

const { useCachedQuery } = await import("../hooks/use-cached-query");

beforeEach(() => store.clear());
afterEach(() => vi.clearAllMocks());

describe("useCachedQuery", () => {
  it("returns null data while loading with no cache present", async () => {
    const { result } = renderHook(() =>
      useCachedQuery(
        { data: undefined, isLoading: true, error: null },
        "key-empty",
        60_000,
      ),
    );
    // Initially loading — cache fetch is async
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.isCached).toBe(false);
  });

  it("returns live data once it arrives and writes it to cache", async () => {
    const { result, rerender } = renderHook(
      ({ data, isLoading }) =>
        useCachedQuery(
          { data, isLoading, error: null },
          "key-live",
          60_000,
        ),
      { initialProps: { data: undefined as any, isLoading: true } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ data: [{ id: 1, title: "Hello" }], isLoading: false });

    await waitFor(() =>
      expect(result.current.data).toEqual([{ id: 1, title: "Hello" }]),
    );
    expect(result.current.isCached).toBe(false);

    // Cache should have been written. Read back via the same key.
    const stored = store.get("key-live");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!).data).toEqual([{ id: 1, title: "Hello" }]);
  });

  it("surfaces cached data while live query is still loading, with isCached: true", async () => {
    // Pre-populate the cache.
    store.set(
      "key-cached",
      JSON.stringify({
        data: [{ id: 99, title: "Cached event" }],
        timestamp: Date.now(),
        ttlMs: 60_000,
      }),
    );

    const { result } = renderHook(() =>
      useCachedQuery(
        { data: undefined, isLoading: true, error: null },
        "key-cached",
        60_000,
      ),
    );

    await waitFor(() =>
      expect(result.current.data).toEqual([{ id: 99, title: "Cached event" }]),
    );
    expect(result.current.isCached).toBe(true);
  });

  it("does not write empty arrays to cache (avoids overwriting useful cache with no-result/error responses)", async () => {
    // Pre-populate good cache.
    store.set(
      "key-empty-arr",
      JSON.stringify({
        data: [{ id: 1, title: "Real event" }],
        timestamp: Date.now(),
        ttlMs: 60_000,
      }),
    );

    const { result } = renderHook(() =>
      useCachedQuery(
        { data: [], isLoading: false, error: null },
        "key-empty-arr",
        60_000,
      ),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Cache should still contain the real event, not the empty array.
    const stored = JSON.parse(store.get("key-empty-arr")!);
    expect(stored.data).toEqual([{ id: 1, title: "Real event" }]);
  });

  it("ignores stale (TTL-expired) cache entries", async () => {
    store.set(
      "key-stale",
      JSON.stringify({
        data: [{ id: 1, title: "Old" }],
        timestamp: Date.now() - 60 * 60 * 1000, // 1h ago
        ttlMs: 60_000, // 1m TTL → expired
      }),
    );

    const { result } = renderHook(() =>
      useCachedQuery(
        { data: undefined, isLoading: true, error: null },
        "key-stale",
        60_000,
      ),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.isCached).toBe(false);
  });

  it("re-reads cache when the key changes (e.g. month navigation)", async () => {
    store.set(
      "key-jan",
      JSON.stringify({
        data: [{ id: 1, title: "Jan event" }],
        timestamp: Date.now(),
        ttlMs: 60_000,
      }),
    );
    store.set(
      "key-feb",
      JSON.stringify({
        data: [{ id: 2, title: "Feb event" }],
        timestamp: Date.now(),
        ttlMs: 60_000,
      }),
    );

    const { result, rerender } = renderHook(
      ({ key }) =>
        useCachedQuery(
          { data: undefined, isLoading: false, error: null },
          key,
          60_000,
        ),
      { initialProps: { key: "key-jan" } },
    );

    await waitFor(() =>
      expect(result.current.data).toEqual([{ id: 1, title: "Jan event" }]),
    );

    rerender({ key: "key-feb" });

    await waitFor(() =>
      expect(result.current.data).toEqual([{ id: 2, title: "Feb event" }]),
    );
  });
});
