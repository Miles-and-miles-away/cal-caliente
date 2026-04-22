/**
 * Nominatim geocoding utility for address → lat/lng conversion.
 * Uses free OpenStreetMap Nominatim service (no API key required).
 * Includes caching to avoid repeated requests.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_USER_AGENT = "Cal-Caliente-Events/1.0 (+https://salsabachatajapan.app)";
const GEOCODING_CACHE_KEY = "@geocoding_cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

interface CachedGeocode {
  result: GeocodeResult;
  timestamp: number;
}

/**
 * Geocode an address using Nominatim.
 * Results are cached locally to avoid repeated requests.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address || address.trim().length === 0) return null;

  // Check cache first
  const cached = await getCachedGeocode(address);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}?${params}`, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
    });

    if (!response.ok) {
      console.error(`[Geocoding] Nominatim error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (data.length === 0) {
      console.warn(`[Geocoding] No results for: ${address}`);
      return null;
    }

    const result: GeocodeResult = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };

    // Cache the result
    await cacheGeocode(address, result);
    return result;
  } catch (error) {
    console.error(`[Geocoding] Error geocoding "${address}":`, error);
    return null;
  }
}

/**
 * Get cached geocode result if it exists and is not expired.
 */
async function getCachedGeocode(address: string): Promise<GeocodeResult | null> {
  try {
    const cacheStr = await AsyncStorage.getItem(GEOCODING_CACHE_KEY);
    if (!cacheStr) return null;

    const cache: Record<string, CachedGeocode> = JSON.parse(cacheStr);
    const key = address.toLowerCase();

    if (key in cache) {
      const cached = cache[key];
      const age = Date.now() - cached.timestamp;

      if (age < CACHE_TTL_MS) {
        return cached.result;
      }

      // Cache expired, remove it
      delete cache[key];
      await AsyncStorage.setItem(GEOCODING_CACHE_KEY, JSON.stringify(cache));
    }

    return null;
  } catch (error) {
    console.error("[Geocoding] Error reading cache:", error);
    return null;
  }
}

/**
 * Store geocode result in cache.
 */
async function cacheGeocode(address: string, result: GeocodeResult): Promise<void> {
  try {
    const cacheStr = await AsyncStorage.getItem(GEOCODING_CACHE_KEY);
    const cache: Record<string, CachedGeocode> = cacheStr ? JSON.parse(cacheStr) : {};

    cache[address.toLowerCase()] = {
      result,
      timestamp: Date.now(),
    };

    await AsyncStorage.setItem(GEOCODING_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("[Geocoding] Error writing cache:", error);
  }
}

/**
 * Clear all cached geocoding results.
 */
export async function clearGeocodeCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GEOCODING_CACHE_KEY);
  } catch (error) {
    console.error("[Geocoding] Error clearing cache:", error);
  }
}
