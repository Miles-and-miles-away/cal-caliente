import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the two db functions geocodeMissingEvents touches; everything else in
// geocode.ts runs for real (fetch is injected via the fetchImpl parameter).
const mockGetEventsMissingCoordinates = vi.fn();
const mockUpdateEventCoordinates = vi.fn();

vi.mock("../server/db", () => ({
  getEventsMissingCoordinates: mockGetEventsMissingCoordinates,
  updateEventCoordinates: mockUpdateEventCoordinates,
}));

const { clearGeocodeCache, geocodeAddress, geocodeMissingEvents, hasCachedGeocode } = await import(
  "../server/geocode"
);

// GSI-style GeoJSON response: coordinates are [longitude, latitude].
const gsiHit = (lng: number, lat: number) =>
  ({
    ok: true,
    json: async () => [{ geometry: { coordinates: [lng, lat] } }],
  }) as unknown as Response;

beforeEach(() => {
  vi.clearAllMocks();
  clearGeocodeCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("geocodeMissingEvents", () => {
  it("skips rows without an address (no fetch, no update)", async () => {
    mockGetEventsMissingCoordinates.mockResolvedValue([
      { id: 1, venueAddress: null },
      { id: 2, venueAddress: "" },
    ]);
    const fetchImpl = vi.fn();
    const result = await geocodeMissingEvents(10, fetchImpl);
    expect(result).toEqual({ scanned: 2, geocoded: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mockUpdateEventCoordinates).not.toHaveBeenCalled();
  });

  it("resolves without any delay when the address is already cached", async () => {
    // Pre-warm the cache, then backfill a row with the same address. No fake
    // timers here: if a sleep were (re)introduced on cache hits, this test
    // would stall for the real 300ms delay per row and time out at scale.
    const warm = vi.fn().mockResolvedValue(gsiHit(139.7, 35.6));
    await geocodeAddress("東京都渋谷区1-2-3", warm);
    expect(hasCachedGeocode("東京都渋谷区1-2-3")).toBe(true);

    mockGetEventsMissingCoordinates.mockResolvedValue([
      { id: 5, venueAddress: "東京都渋谷区1-2-3" },
    ]);
    const fetchImpl = vi.fn();
    const result = await geocodeMissingEvents(10, fetchImpl);

    expect(result).toEqual({ scanned: 1, geocoded: 1 });
    // Served from cache — the backfill itself never hit the network.
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mockUpdateEventCoordinates).toHaveBeenCalledWith(5, 35.6, 139.7);
  });

  it("pays the polite delay after a cache miss before finishing", async () => {
    vi.useFakeTimers();
    mockGetEventsMissingCoordinates.mockResolvedValue([
      { id: 7, venueAddress: "大阪府大阪市北区4-5-6" },
    ]);
    const fetchImpl = vi.fn().mockResolvedValue(gsiHit(135.5, 34.7));

    let done = false;
    const p = geocodeMissingEvents(10, fetchImpl).then((r) => {
      done = true;
      return r;
    });

    // The lookup itself completes, but the loop must still be parked on the
    // 300ms politeness sleep.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);

    await vi.advanceTimersByTimeAsync(300);
    const result = await p;
    expect(result).toEqual({ scanned: 1, geocoded: 1 });
    expect(mockUpdateEventCoordinates).toHaveBeenCalledWith(7, 34.7, 135.5);
  });

  it("queries GSI once for repeat venues in the same batch", async () => {
    vi.useFakeTimers();
    const addr = "東京都新宿区7-8-9";
    mockGetEventsMissingCoordinates.mockResolvedValue([
      { id: 11, venueAddress: addr },
      { id: 12, venueAddress: addr },
      { id: 13, venueAddress: addr },
    ]);
    const fetchImpl = vi.fn().mockResolvedValue(gsiHit(139.7, 35.69));

    const p = geocodeMissingEvents(10, fetchImpl);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result).toEqual({ scanned: 3, geocoded: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(1); // rows 2 and 3 hit the cache
    expect(mockUpdateEventCoordinates).toHaveBeenCalledTimes(3);
  });

  it("leaves coordinates untouched when the address doesn't resolve", async () => {
    vi.useFakeTimers();
    mockGetEventsMissingCoordinates.mockResolvedValue([{ id: 21, venueAddress: "謎の住所" }]);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => [] } as any);

    const p = geocodeMissingEvents(10, fetchImpl);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result).toEqual({ scanned: 1, geocoded: 0 });
    expect(mockUpdateEventCoordinates).not.toHaveBeenCalled();
  });
});

describe("geocode cache eviction (FIFO at capacity)", () => {
  it("evicts the oldest entry once the cache exceeds 5000 entries", async () => {
    // MAX_CACHE_ENTRIES is 5000 (server/geocode.ts) — fill one past capacity.
    const fetchImpl = vi.fn().mockResolvedValue(gsiHit(139.7, 35.6));
    // Re-mock json() per call since Response.json is single-use in real life;
    // our stub is reusable, so one mock object is fine here.
    for (let i = 0; i <= 5000; i++) {
      fetchImpl.mockResolvedValueOnce(gsiHit(139.7, 35.6));
      await geocodeAddress(`addr-${i}`, fetchImpl);
    }
    expect(hasCachedGeocode("addr-0")).toBe(false); // evicted
    expect(hasCachedGeocode("addr-1")).toBe(true);
    expect(hasCachedGeocode("addr-5000")).toBe(true);
  });
});
