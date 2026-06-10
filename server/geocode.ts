// Geocoding for scraped events. Sources like iCal feeds provide a venue
// address (often a full Japanese postal address, e.g.
// "〒116-0014 東京都荒川区東日暮里６丁目６０−９ 日暮里駅前ビル 3階") but no
// coordinates. The GSI (国土地理院 / Geospatial Information Authority of
// Japan) address-search API resolves Japanese addresses for free with no API
// key. Results — including misses — are cached in-memory per normalized
// address so repeat venues (50+ events at the same club) cost one request
// per process lifetime, and a polite delay is only paid on actual requests.

import { getEventsMissingCoordinates, updateEventCoordinates } from "./db";

const GSI_ENDPOINT = "https://msearch.gsi.go.jp/address-search/AddressSearch";

// Pause between live GSI requests during backfill. GSI publishes no hard rate
// limit; stay well under anything that could look like abuse.
const GEOCODE_REQUEST_DELAY_MS = 300;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

// null = looked up and not found (cached so bad addresses aren't re-queried).
// Bounded so a long-running process that sees a wide spread of unique addresses
// can't grow the map without limit; Map preserves insertion order, so we evict
// the oldest entry once over capacity (simple FIFO — venues recur, so the hot
// set stays cached in practice).
const MAX_CACHE_ENTRIES = 5000;
const cache = new Map<string, GeoPoint | null>();

function cacheSet(query: string, value: GeoPoint | null): void {
  cache.set(query, value);
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/** Test hook — the cache is module-global state. */
export function clearGeocodeCache(): void {
  cache.clear();
}

/**
 * Reduces a scraped venue address to the administrative part GSI matches
 * best: strips the postal-code marker (〒116-0014) and building/floor
 * suffixes, which in well-formed Japanese addresses follow the first
 * whitespace after the block number.
 */
export function normalizeJapaneseAddress(raw: string): string {
  const withoutPostal = raw.replace(/〒\s*\d{3}[-−ー‐]?\d{4}/g, " ").trim();
  const firstToken = withoutPostal.split(/\s+/)[0] ?? "";
  return firstToken || withoutPostal;
}

/** Whether a previous lookup (hit or miss) for this address is cached. */
export function hasCachedGeocode(address: string): boolean {
  return cache.has(normalizeJapaneseAddress(address));
}

/**
 * Resolves a Japanese address to coordinates via GSI. Returns null when the
 * address doesn't resolve. Lookup misses are cached; transport errors and
 * non-OK responses are NOT cached, so transient failures retry next cycle.
 */
export async function geocodeAddress(
  address: string,
  fetchImpl: FetchLike = fetch,
): Promise<GeoPoint | null> {
  const query = normalizeJapaneseAddress(address);
  if (!query) return null;
  if (cache.has(query)) return cache.get(query) ?? null;

  try {
    const res = await fetchImpl(`${GSI_ENDPOINT}?q=${encodeURIComponent(query)}`, {
      headers: {
        // Identify ourselves to the public API.
        "User-Agent": "cal-caliente/1.0 (latin dance event calendar; venue geocoding)",
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Array<{
      geometry?: { coordinates?: [number, number] };
    }>;
    // GSI returns GeoJSON-style features: coordinates are [longitude, latitude].
    const coords = data?.[0]?.geometry?.coordinates;
    const result =
      Array.isArray(coords) && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
        ? { latitude: coords[1], longitude: coords[0] }
        : null;
    cacheSet(query, result);
    return result;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Backfills coordinates for events that have a venue address but no
 * lat/lng. Runs after each scrape cycle. Sequential on purpose — the
 * per-request delay (only paid on cache misses) keeps load on GSI polite.
 */
export async function geocodeMissingEvents(
  limit = 200,
  fetchImpl: FetchLike = fetch,
): Promise<{ scanned: number; geocoded: number }> {
  const rows = await getEventsMissingCoordinates(limit);
  let geocoded = 0;

  for (const row of rows) {
    if (!row.venueAddress) continue;
    const wasCached = hasCachedGeocode(row.venueAddress);
    const point = await geocodeAddress(row.venueAddress, fetchImpl);
    if (point) {
      await updateEventCoordinates(row.id, point.latitude, point.longitude);
      geocoded++;
    }
    if (!wasCached) await sleep(GEOCODE_REQUEST_DELAY_MS);
  }

  return { scanned: rows.length, geocoded };
}
