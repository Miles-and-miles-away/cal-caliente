import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "@/shared/constants";

/**
 * Cache management utilities for offline-first architecture.
 * All cache operations are wrapped in try-catch to handle storage failures gracefully.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs?: number;
}

/**
 * Check if a cache entry is still valid (not expired).
 */
function isValid<T>(entry: CacheEntry<T>): boolean {
  if (!entry.ttlMs) return true;
  return Date.now() - entry.timestamp < entry.ttlMs;
}

/**
 * Get cached data with optional TTL validation.
 */
export async function getCache<T>(
  key: string,
  options?: { validateTTL?: boolean }
): Promise<T | null> {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    const entry: CacheEntry<T> = JSON.parse(stored);

    if (options?.validateTTL && !isValid(entry)) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn(`[Cache] Failed to get ${key}:`, error);
    return null;
  }
}

/**
 * Set cached data with optional TTL.
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttlMs?: number
): Promise<boolean> {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttlMs,
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
    return true;
  } catch (error) {
    console.warn(`[Cache] Failed to set ${key}:`, error);
    return false;
  }
}

/**
 * Remove cached data.
 */
export async function removeCache(key: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[Cache] Failed to remove ${key}:`, error);
    return false;
  }
}

/**
 * Clear all app caches (but preserve preferences and favorites).
 */
export async function clearEventCaches(): Promise<boolean> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const eventCacheKeys = keys.filter(
      (k) =>
        k.startsWith("@salsa_events_") ||
        k.startsWith("@salsa_search_") ||
        k.startsWith("@salsa_event_detail_")
    );
    await AsyncStorage.multiRemove(eventCacheKeys);
    return true;
  } catch (error) {
    console.warn("[Cache] Failed to clear event caches:", error);
    return false;
  }
}

/**
 * Get storage usage estimate (for debugging).
 */
export async function getStorageUsage(): Promise<{
  used: number;
  total: number;
  percentage: number;
}> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    let totalSize = 0;

    for (const key of keys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    }

    // AsyncStorage typically has ~10MB limit on most devices
    const totalLimit = 10 * 1024 * 1024;
    return {
      used: totalSize,
      total: totalLimit,
      percentage: (totalSize / totalLimit) * 100,
    };
  } catch (error) {
    console.warn("[Cache] Failed to get storage usage:", error);
    return { used: 0, total: 0, percentage: 0 };
  }
}

/**
 * Cache keys for events.
 */
export const CACHE_KEYS = {
  // Events: @salsa_events_{year}_{month}
  eventsByMonth: (year: number, month: number) =>
    `@salsa_events_${year}_${month}`,

  // Event details: @salsa_event_detail_{id}
  eventDetail: (id: number) => `@salsa_event_detail_${id}`,

  // Search results: @salsa_search_{hash}
  searchResults: (hash: string) => `@salsa_search_${hash}`,

  // Sources: @salsa_sources
  sources: "@salsa_sources",

  // All events (for map): @salsa_events_all
  allEvents: "@salsa_events_all",
} as const;

/**
 * Cache TTLs (in milliseconds).
 */
export const CACHE_TTL = {
  events: 24 * 60 * 60 * 1000, // 24 hours
  eventDetail: 24 * 60 * 60 * 1000, // 24 hours
  searchResults: 1 * 60 * 60 * 1000, // 1 hour
  sources: 24 * 60 * 60 * 1000, // 24 hours
  allEvents: 24 * 60 * 60 * 1000, // 24 hours
} as const;
