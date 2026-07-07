import {
  computeCanonicalKey,
  computeVenueDateKey,
  normalizeTitleForKey,
  normalizeVenueForKey,
} from "../keys";

// Golden vectors generated from the OLD server's implementation
// (cal-caliente/server/db.ts) — the port MUST produce identical hashes for
// identical inputs, since canonicalKey is the events doc id.

describe("normalizeTitleForKey", () => {
  it("strips bracketed prefixes and years, collapses punctuation", () => {
    expect(normalizeTitleForKey("(JAPAN) Salsa Festival 2026!!")).toBe("salsa festival");
  });

  it("collapses runs of punctuation and whitespace", () => {
    expect(normalizeTitleForKey("Tokyo  Salsa — Night!")).toBe("tokyo salsa night");
  });

  it("keeps katakana, collapsing CJK punctuation", () => {
    expect(normalizeTitleForKey("サルサ・ナイト")).toBe("サルサ ナイト");
  });
});

describe("computeCanonicalKey", () => {
  it("matches the old implementation's hash (golden vector)", () => {
    expect(computeCanonicalKey("Tokyo Salsa Night", "2026-08-01T19:00:00+09:00")).toBe(
      "49d781fa649b5656f832a1416095b3b5",
    );
  });

  it("produces the same key across title variants and input types", () => {
    // Parenthetical prefix + year suffix + case variance + Date vs string
    expect(
      computeCanonicalKey(
        "(JAPAN) Tokyo salsa NIGHT 2026",
        new Date("2026-08-01T19:00:00+09:00"),
      ),
    ).toBe("49d781fa649b5656f832a1416095b3b5");
  });

  it("hashes katakana titles stably (golden vector)", () => {
    expect(computeCanonicalKey("サルサ・ナイト", "2026-08-15T20:00:00+09:00")).toBe(
      "1c52be7a0bcccf7823a322d8368de380",
    );
  });

  it("uses UTC day precision — different days give different keys", () => {
    const a = computeCanonicalKey("Salsa Night", "2026-08-01T19:00:00+09:00");
    const b = computeCanonicalKey("Salsa Night", "2026-08-02T19:00:00+09:00");
    expect(a).not.toBe(b);
  });
});

describe("normalizeVenueForKey", () => {
  it("strips generic venue words and punctuation", () => {
    expect(normalizeVenueForKey("Club Salud, Tokyo")).toBe("salud tokyo");
  });
});

describe("computeVenueDateKey", () => {
  it("matches the old implementation's hash (golden vector)", () => {
    expect(computeVenueDateKey("Club Salud, Tokyo", "2026-08-01T19:00:00+09:00")).toBe(
      "398d18ec8088f827d4378a230d92960f",
    );
  });

  it("is hour-precision: same venue + same hour matches across variants", () => {
    // "SALUD Tokyo" at 19:30 normalizes to the same venue and the same
    // UTC hour as "Club Salud, Tokyo" at 19:00.
    expect(
      computeVenueDateKey("SALUD  Tokyo", new Date("2026-08-01T19:30:00+09:00")),
    ).toBe("398d18ec8088f827d4378a230d92960f");
  });

  it("returns null without a venue", () => {
    expect(computeVenueDateKey(null, "2026-08-01T19:00:00+09:00")).toBeNull();
    expect(computeVenueDateKey(undefined, "2026-08-01T19:00:00+09:00")).toBeNull();
    expect(computeVenueDateKey("", "2026-08-01T19:00:00+09:00")).toBeNull();
  });

  it("returns null when normalization leaves <3 chars (e.g. 'Bar')", () => {
    expect(computeVenueDateKey("Bar", "2026-08-01T19:00:00+09:00")).toBeNull();
  });

  it("distinguishes different hours at the same venue", () => {
    const seven = computeVenueDateKey("Club Salud, Tokyo", "2026-08-01T19:00:00+09:00");
    const nine = computeVenueDateKey("Club Salud, Tokyo", "2026-08-01T21:00:00+09:00");
    expect(seven).not.toBe(nine);
  });
});
