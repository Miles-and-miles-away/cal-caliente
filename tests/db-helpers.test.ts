import { describe, expect, it } from "vitest";
import {
  computeCanonicalKey,
  computeVenueDateKey,
  escapeLikePattern,
  normalizeTitleForKey,
  normalizeVenueForKey,
} from "../server/db";

describe("server/db helpers", () => {
  describe("escapeLikePattern", () => {
    it("should return the same string if no special characters", () => {
      expect(escapeLikePattern("hello world")).toBe("hello world");
    });

    it("should escape percent signs", () => {
      expect(escapeLikePattern("100%")).toBe("100\\%");
      expect(escapeLikePattern("%drop%")).toBe("\\%drop\\%");
    });

    it("should escape underscores", () => {
      expect(escapeLikePattern("user_name")).toBe("user\\_name");
      expect(escapeLikePattern("__init__")).toBe("\\_\\_init\\_\\_");
    });

    it("should escape backslashes", () => {
      expect(escapeLikePattern("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("should escape multiple special characters together", () => {
      expect(escapeLikePattern("%_\\")).toBe("\\%\\_\\\\");
    });

    it("should handle empty strings", () => {
      expect(escapeLikePattern("")).toBe("");
    });

    it("should handle strings with only special characters", () => {
      expect(escapeLikePattern("%%%")).toBe("\\%\\%\\%");
    });

    it("should not escape other special characters", () => {
      expect(escapeLikePattern("hello@world!")).toBe("hello@world!");
      expect(escapeLikePattern("price: $100")).toBe("price: $100");
    });

    it("should handle Japanese characters", () => {
      expect(escapeLikePattern("サルサ")).toBe("サルサ");
      expect(escapeLikePattern("東京%")).toBe("東京\\%");
    });
  });

  describe("normalizeTitleForKey", () => {
    it("strips leading parenthetical prefixes", () => {
      expect(normalizeTitleForKey("(JAPAN) BMJ Sensual Festival 2026 Tokyo"))
        .toBe(normalizeTitleForKey("BMJ Sensual Festival 2026 Tokyo"));
      expect(normalizeTitleForKey("[FESTIVAL] La Bachata Tokyo"))
        .toBe(normalizeTitleForKey("La Bachata Tokyo"));
    });

    it("strips 4-digit years", () => {
      expect(normalizeTitleForKey("BMJ Festival 2026"))
        .toBe(normalizeTitleForKey("BMJ Festival"));
      expect(normalizeTitleForKey("Foo 2099"))
        .toBe(normalizeTitleForKey("Foo"));
    });

    it("does not strip 3-digit numbers (avoids over-eager matches)", () => {
      expect(normalizeTitleForKey("Foo 123")).toBe("foo 123");
    });

    it("collapses punctuation and whitespace", () => {
      expect(normalizeTitleForKey("Foo — Bar! Baz"))
        .toBe(normalizeTitleForKey("Foo Bar Baz"));
      expect(normalizeTitleForKey("  Foo   Bar  ")).toBe("foo bar");
    });

    it("preserves non-Latin scripts", () => {
      expect(normalizeTitleForKey("サルサ Night")).toBe("サルサ night");
      expect(normalizeTitleForKey("東京サルサ")).toBe("東京サルサ");
    });

    it("is case-insensitive", () => {
      expect(normalizeTitleForKey("FOO BAR")).toBe(normalizeTitleForKey("foo bar"));
    });
  });

  describe("computeCanonicalKey", () => {
    const sameDate = "2026-06-30T19:00:00+09:00";

    it("produces the same key for the same event titled differently across sources", () => {
      const a = computeCanonicalKey("BMJ Sensual Festival 2026 Tokyo", sameDate);
      const b = computeCanonicalKey("(JAPAN) BMJ Sensual Festival 2026 Tokyo", sameDate);
      expect(a).toBe(b);
    });

    it("uses day precision — different times on the same day collide", () => {
      const morning = computeCanonicalKey("Salsa Social", "2026-06-30T10:00:00+09:00");
      const evening = computeCanonicalKey("Salsa Social", "2026-06-30T22:00:00+09:00");
      expect(morning).toBe(evening);
    });

    it("differentiates the same event title on different dates", () => {
      const day1 = computeCanonicalKey("Salsa Social", "2026-06-30T19:00:00+09:00");
      const day2 = computeCanonicalKey("Salsa Social", "2026-07-01T19:00:00+09:00");
      expect(day1).not.toBe(day2);
    });

    it("differentiates genuinely different events on the same date", () => {
      const a = computeCanonicalKey("Salsa Class at Studio R", sameDate);
      const b = computeCanonicalKey("Bachata Social at El Caribe", sameDate);
      expect(a).not.toBe(b);
    });

    it("accepts both Date and string startAt", () => {
      const fromDate = computeCanonicalKey("Foo", new Date("2026-06-30T00:00:00Z"));
      const fromStr = computeCanonicalKey("Foo", "2026-06-30T00:00:00Z");
      expect(fromDate).toBe(fromStr);
    });

    it("returns a 32-char hex string", () => {
      const k = computeCanonicalKey("Foo", sameDate);
      expect(k).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe("normalizeVenueForKey", () => {
    it("strips generic location-type words", () => {
      expect(normalizeVenueForKey("Club Salud")).toBe(normalizeVenueForKey("Salud"));
      expect(normalizeVenueForKey("Salsa Bar Tokyo")).toBe(normalizeVenueForKey("Salsa Tokyo"));
      expect(normalizeVenueForKey("Dance Studio R")).toBe(normalizeVenueForKey("Dance R"));
    });

    it("collapses punctuation and is case-insensitive", () => {
      expect(normalizeVenueForKey("Club Salud!")).toBe(normalizeVenueForKey("club  salud"));
      expect(normalizeVenueForKey("Café Latino")).toBe(normalizeVenueForKey("CAFÉ LATINO"));
    });

    it("preserves Japanese venue text", () => {
      expect(normalizeVenueForKey("日暮里サルー")).toBe("日暮里サルー");
    });
  });

  describe("computeVenueDateKey", () => {
    const same = "2026-06-15T19:00:00+09:00";

    it("matches across cosmetic venue variations at the same hour", () => {
      const a = computeVenueDateKey("Club Salud!", same);
      const b = computeVenueDateKey("Salud (Bar)", same);
      expect(a).toBe(b);
    });

    it("differentiates by hour — same venue different times", () => {
      const seven = computeVenueDateKey("Club Salud", "2026-06-15T19:00:00+09:00");
      const nine = computeVenueDateKey("Club Salud", "2026-06-15T21:00:00+09:00");
      expect(seven).not.toBe(nine);
    });

    it("differentiates by date — same venue different days", () => {
      const tue = computeVenueDateKey("Club Salud", "2026-06-15T19:00:00+09:00");
      const wed = computeVenueDateKey("Club Salud", "2026-06-16T19:00:00+09:00");
      expect(tue).not.toBe(wed);
    });

    it("returns null when venue is missing or too short post-normalization", () => {
      expect(computeVenueDateKey(null, same)).toBeNull();
      expect(computeVenueDateKey("", same)).toBeNull();
      expect(computeVenueDateKey("Bar", same)).toBeNull();   // strips to "" then < 3 chars
      expect(computeVenueDateKey("X!", same)).toBeNull();     // 1 char post-normalize
    });

    it("does NOT match cross-language venue names (documented limitation)", () => {
      // Same physical venue, different scripts — cannot dedup without an
      // alias table or LLM clustering. This test documents the gap.
      const en = computeVenueDateKey("Club Salud", same);
      const ja = computeVenueDateKey("日暮里サルー", same);
      expect(en).not.toBe(ja);
    });
  });
});
