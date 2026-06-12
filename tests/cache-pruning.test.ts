import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearEventCaches, getStorageUsage, pruneSearchCaches } from "../lib/cache";

// Mock AsyncStorage (same shape as cache.test.ts).
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getAllKeys: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

const storage = AsyncStorage as unknown as Record<string, ReturnType<typeof vi.fn>>;

const entry = (timestamp: number) => JSON.stringify({ data: [], timestamp });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("clearEventCaches", () => {
  it("removes only event/search/detail keys, preserving preferences and favorites", async () => {
    storage.getAllKeys.mockResolvedValue([
      "@salsa_events_2026_7",
      "@salsa_search_abc123",
      "@salsa_event_detail_42",
      "@salsa_preferences",
      "@salsa_favorites",
      "@salsa_sources",
    ]);
    storage.multiRemove.mockResolvedValue(undefined);

    await expect(clearEventCaches()).resolves.toBe(true);
    expect(storage.multiRemove).toHaveBeenCalledWith([
      "@salsa_events_2026_7",
      "@salsa_search_abc123",
      "@salsa_event_detail_42",
    ]);
  });

  it("returns false instead of throwing when storage fails", async () => {
    storage.getAllKeys.mockRejectedValue(new Error("quota"));
    await expect(clearEventCaches()).resolves.toBe(false);
  });
});

describe("pruneSearchCaches", () => {
  it("does nothing while at or under the cap (no reads, no removals)", async () => {
    storage.getAllKeys.mockResolvedValue(["@salsa_search_a", "@salsa_search_b"]);
    await pruneSearchCaches(2);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.multiRemove).not.toHaveBeenCalled();
  });

  it("evicts the oldest entries beyond the cap, keeping the newest", async () => {
    storage.getAllKeys.mockResolvedValue([
      "@salsa_search_old",
      "@salsa_search_newest",
      "@salsa_search_mid",
      "@salsa_events_2026_7", // not a search key — must be ignored
    ]);
    const timestamps: Record<string, string> = {
      "@salsa_search_old": entry(1_000),
      "@salsa_search_newest": entry(3_000),
      "@salsa_search_mid": entry(2_000),
    };
    storage.getItem.mockImplementation(async (k: string) => timestamps[k] ?? null);
    storage.multiRemove.mockResolvedValue(undefined);

    await pruneSearchCaches(2);

    expect(storage.multiRemove).toHaveBeenCalledWith(["@salsa_search_old"]);
  });

  it("treats unparseable entries as oldest so they're evicted first", async () => {
    storage.getAllKeys.mockResolvedValue([
      "@salsa_search_corrupt",
      "@salsa_search_a",
      "@salsa_search_b",
    ]);
    storage.getItem.mockImplementation(async (k: string) =>
      k === "@salsa_search_corrupt" ? "not json{" : entry(5_000),
    );
    storage.multiRemove.mockResolvedValue(undefined);

    await pruneSearchCaches(2);

    expect(storage.multiRemove).toHaveBeenCalledWith(["@salsa_search_corrupt"]);
  });

  it("swallows storage errors (pruning is best-effort)", async () => {
    storage.getAllKeys.mockRejectedValue(new Error("quota"));
    await expect(pruneSearchCaches(2)).resolves.toBeUndefined();
  });
});

describe("getStorageUsage", () => {
  it("sums stored value sizes against the 10MB budget", async () => {
    storage.getAllKeys.mockResolvedValue(["a", "b", "empty"]);
    storage.getItem.mockImplementation(async (k: string) =>
      k === "a" ? "x".repeat(1000) : k === "b" ? "y".repeat(500) : null,
    );

    const usage = await getStorageUsage();

    expect(usage.used).toBe(1500);
    expect(usage.total).toBe(10 * 1024 * 1024);
    expect(usage.percentage).toBeCloseTo((1500 / (10 * 1024 * 1024)) * 100);
  });

  it("returns zeros instead of throwing when storage fails", async () => {
    storage.getAllKeys.mockRejectedValue(new Error("quota"));
    await expect(getStorageUsage()).resolves.toEqual({ used: 0, total: 0, percentage: 0 });
  });
});
