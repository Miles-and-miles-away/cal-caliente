import { describe, expect, it, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getCache,
  setCache,
  removeCache,
  CACHE_KEYS,
  CACHE_TTL,
} from "../lib/cache";

// Mock AsyncStorage
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getAllKeys: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

describe("Cache utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setCache", () => {
    it("should store data with timestamp", async () => {
      const testData = { id: 1, title: "Test Event" };
      await setCache("test_key", testData);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const [key, value] = (AsyncStorage.setItem as any).mock.calls[0];
      expect(key).toBe("test_key");

      const stored = JSON.parse(value);
      expect(stored.data).toEqual(testData);
      expect(stored.timestamp).toBeDefined();
      expect(typeof stored.timestamp).toBe("number");
    });

    it("should store TTL if provided", async () => {
      const testData = { id: 1 };
      const ttl = 60000;
      await setCache("test_key", testData, ttl);

      const [, value] = (AsyncStorage.setItem as any).mock.calls[0];
      const stored = JSON.parse(value);
      expect(stored.ttlMs).toBe(ttl);
    });

    it("should return true on success", async () => {
      (AsyncStorage.setItem as any).mockResolvedValueOnce(undefined);
      const result = await setCache("test_key", { data: "test" });
      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      (AsyncStorage.setItem as any).mockRejectedValueOnce(new Error("Storage error"));
      const result = await setCache("test_key", { data: "test" });
      expect(result).toBe(false);
    });
  });

  describe("getCache", () => {
    it("should retrieve cached data", async () => {
      const testData = { id: 1, title: "Test Event" };
      const cacheEntry = {
        data: testData,
        timestamp: Date.now(),
      };
      (AsyncStorage.getItem as any).mockResolvedValueOnce(JSON.stringify(cacheEntry));

      const result = await getCache("test_key");
      expect(result).toEqual(testData);
    });

    it("should return null if key doesn't exist", async () => {
      (AsyncStorage.getItem as any).mockResolvedValueOnce(null);
      const result = await getCache("nonexistent_key");
      expect(result).toBeNull();
    });

    it("should validate TTL when requested", async () => {
      const expiredEntry = {
        data: { id: 1 },
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        ttlMs: 60 * 60 * 1000, // 1 hour TTL
      };
      (AsyncStorage.getItem as any).mockResolvedValueOnce(JSON.stringify(expiredEntry));

      const result = await getCache("test_key", { validateTTL: true });
      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("test_key");
    });

    it("should return data if TTL is still valid", async () => {
      const testData = { id: 1 };
      const validEntry = {
        data: testData,
        timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
        ttlMs: 60 * 60 * 1000, // 1 hour TTL
      };
      (AsyncStorage.getItem as any).mockResolvedValueOnce(JSON.stringify(validEntry));

      const result = await getCache("test_key", { validateTTL: true });
      expect(result).toEqual(testData);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it("should return null on error", async () => {
      (AsyncStorage.getItem as any).mockRejectedValueOnce(new Error("Storage error"));
      const result = await getCache("test_key");
      expect(result).toBeNull();
    });
  });

  describe("removeCache", () => {
    it("should remove cached data", async () => {
      (AsyncStorage.removeItem as any).mockResolvedValueOnce(undefined);
      const result = await removeCache("test_key");
      expect(result).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("test_key");
    });

    it("should return false on error", async () => {
      (AsyncStorage.removeItem as any).mockRejectedValueOnce(new Error("Storage error"));
      const result = await removeCache("test_key");
      expect(result).toBe(false);
    });
  });

  describe("CACHE_KEYS", () => {
    it("should generate correct event month cache key", () => {
      const key = CACHE_KEYS.eventsByMonth(2026, 4);
      expect(key).toBe("@salsa_events_2026_4");
    });

    it("should generate correct event detail cache key", () => {
      const key = CACHE_KEYS.eventDetail(123);
      expect(key).toBe("@salsa_event_detail_123");
    });

    it("should generate correct search results cache key", () => {
      const key = CACHE_KEYS.searchResults("abc123");
      expect(key).toBe("@salsa_search_abc123");
    });

    it("should have correct constant keys", () => {
      expect(CACHE_KEYS.sources).toBe("@salsa_sources");
      expect(CACHE_KEYS.allEvents).toBe("@salsa_events_all");
    });
  });

  describe("CACHE_TTL", () => {
    it("should have reasonable TTL values", () => {
      expect(CACHE_TTL.events).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(CACHE_TTL.eventDetail).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(CACHE_TTL.searchResults).toBe(1 * 60 * 60 * 1000); // 1 hour
      expect(CACHE_TTL.sources).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(CACHE_TTL.allEvents).toBe(24 * 60 * 60 * 1000); // 24 hours
    });

    it("should have searchResults TTL shorter than events TTL", () => {
      expect(CACHE_TTL.searchResults).toBeLessThan(CACHE_TTL.events);
    });
  });
});
