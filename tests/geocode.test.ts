import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearGeocodeCache,
  geocodeAddress,
  hasCachedGeocode,
  normalizeJapaneseAddress,
} from "../server/geocode";

const SALUD_ADDRESS = "〒116-0014 東京都荒川区東日暮里６丁目６０−９ 日暮里駅前ビル 3階";

// GSI returns GeoJSON-style features with [longitude, latitude] coordinates.
function gsiResponse(features: unknown[]): Response {
  return {
    ok: true,
    json: async () => features,
  } as unknown as Response;
}

const NIPPORI_FEATURE = {
  geometry: { coordinates: [139.7757, 35.7312], type: "Point" },
  type: "Feature",
  properties: { title: "東京都荒川区東日暮里六丁目" },
};

afterEach(() => {
  clearGeocodeCache();
});

describe("normalizeJapaneseAddress", () => {
  it("strips the postal-code marker and building/floor suffix", () => {
    expect(normalizeJapaneseAddress(SALUD_ADDRESS)).toBe("東京都荒川区東日暮里６丁目６０−９");
  });

  it("returns plain addresses unchanged", () => {
    expect(normalizeJapaneseAddress("東京都渋谷区道玄坂２丁目１０−１２")).toBe(
      "東京都渋谷区道玄坂２丁目１０−１２",
    );
  });
});

describe("geocodeAddress", () => {
  it("resolves GSI [lng, lat] coordinates into {latitude, longitude}", async () => {
    const fetchMock = vi.fn(async (_url: string) => gsiResponse([NIPPORI_FEATURE]));
    const point = await geocodeAddress(SALUD_ADDRESS, fetchMock);
    expect(point).toEqual({ latitude: 35.7312, longitude: 139.7757 });
    // Query must be the normalized (postal-code-free) address.
    expect(fetchMock.mock.calls[0][0]).toContain(
      encodeURIComponent("東京都荒川区東日暮里６丁目６０−９"),
    );
  });

  it("caches results so repeat venues cost one request", async () => {
    const fetchMock = vi.fn(async () => gsiResponse([NIPPORI_FEATURE]));
    await geocodeAddress(SALUD_ADDRESS, fetchMock);
    await geocodeAddress(SALUD_ADDRESS, fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hasCachedGeocode(SALUD_ADDRESS)).toBe(true);
  });

  it("caches lookup misses (empty result) so bad addresses aren't re-queried", async () => {
    const fetchMock = vi.fn(async () => gsiResponse([]));
    expect(await geocodeAddress("不存在の住所", fetchMock)).toBeNull();
    expect(await geocodeAddress("不存在の住所", fetchMock)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache transport failures, so they retry next cycle", async () => {
    const failing = vi.fn(async () => ({ ok: false }) as unknown as Response);
    expect(await geocodeAddress(SALUD_ADDRESS, failing)).toBeNull();
    expect(hasCachedGeocode(SALUD_ADDRESS)).toBe(false);

    const working = vi.fn(async () => gsiResponse([NIPPORI_FEATURE]));
    expect(await geocodeAddress(SALUD_ADDRESS, working)).toEqual({
      latitude: 35.7312,
      longitude: 139.7757,
    });
  });

  it("returns null on thrown network errors without caching", async () => {
    const throwing = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    expect(await geocodeAddress(SALUD_ADDRESS, throwing)).toBeNull();
    expect(hasCachedGeocode(SALUD_ADDRESS)).toBe(false);
  });

  it("rejects malformed coordinate payloads", async () => {
    const fetchMock = vi.fn(async () =>
      gsiResponse([{ geometry: { coordinates: ["not", "numbers"] } }]),
    );
    expect(await geocodeAddress(SALUD_ADDRESS, fetchMock)).toBeNull();
  });
});
