import { describe, expect, it } from "vitest";
import { isSameDomain, needsEnrichment } from "../server/scraper";
import type { ScrapedEvent } from "../server/scraper";

const base: ScrapedEvent = {
  externalId: "x-1",
  title: "Salsa Night",
  startAt: "2026-07-10T19:00:00+09:00",
};

describe("needsEnrichment", () => {
  it("wants enrichment when both address and coords are missing", () => {
    expect(needsEnrichment(base)).toBe(true);
  });

  it("wants enrichment when only one of address/coords is present", () => {
    expect(needsEnrichment({ ...base, venueAddress: "Tokyo somewhere" })).toBe(true);
    expect(needsEnrichment({ ...base, latitude: 35.6, longitude: 139.7 })).toBe(true);
  });

  it("skips events that already have address AND coords (no wasted LLM fetches)", () => {
    expect(
      needsEnrichment({ ...base, venueAddress: "Tokyo", latitude: 35.6, longitude: 139.7 }),
    ).toBe(false);
  });

  it("treats latitude 0 / longitude 0 as present, not missing", () => {
    // `!= null` not falsiness — coordinates of 0 are valid (if unlikely in Japan).
    expect(needsEnrichment({ ...base, venueAddress: "x", latitude: 0, longitude: 0 })).toBe(false);
  });
});

describe("isSameDomain (no cross-site enrichment fetches)", () => {
  it("matches identical hosts", () => {
    expect(isSameDomain("https://example.com/event/1", "https://example.com/list")).toBe(true);
  });

  it("rejects a different domain", () => {
    expect(isSameDomain("https://evil.example/event", "https://example.com/list")).toBe(false);
  });

  it("rejects subdomains — host must match exactly", () => {
    expect(isSameDomain("https://cdn.example.com/e", "https://example.com/list")).toBe(false);
    expect(isSameDomain("https://example.com.evil.tld/e", "https://example.com/list")).toBe(false);
  });

  it("rejects a port mismatch", () => {
    expect(isSameDomain("https://example.com:8443/e", "https://example.com/list")).toBe(false);
  });

  it("ignores scheme differences when the host matches", () => {
    expect(isSameDomain("http://example.com/e", "https://example.com/list")).toBe(true);
  });

  it("rejects malformed URLs instead of throwing", () => {
    expect(isSameDomain("not a url", "https://example.com")).toBe(false);
    expect(isSameDomain("https://example.com", "not a url")).toBe(false);
  });
});
