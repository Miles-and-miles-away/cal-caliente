import { createHash } from "node:crypto";

// ─── Cross-source dedup ──────────────────────────────────────────────────────
//
// Ported VERBATIM from the old server/db.ts — these MUST produce identical
// hashes for identical inputs, since canonicalKey is the events doc id and
// existing data / other tooling depends on it.
//
// computeCanonicalKey produces a stable hash that's the same for the "same
// event" reported by different sources. Tuned to handle the realistic spread
// of titles across sources (parenthetical prefixes, year suffixes,
// punctuation variance).

export function normalizeTitleForKey(title: string): string {
  return title
    .normalize("NFC")
    .toLowerCase()
    // Strip leading parenthetical/bracketed prefix: "(JAPAN) Foo", "[FESTIVAL] Foo"
    .replace(/^[(\[][^)\]]+[)\]]\s*/, "")
    // Strip 4-digit years (date provides disambiguation)
    .replace(/\b(19|20)\d{2}\b/g, "")
    // Collapse non-alphanumeric runs (incl. CJK punctuation, em-dashes) to one space
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function computeCanonicalKey(title: string, startAt: Date | string): string {
  const t = normalizeTitleForKey(title);
  const date = (startAt instanceof Date ? startAt : new Date(startAt))
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD — day precision so multi-day festivals match
  return createHash("sha256").update(`${t}|${date}`).digest("hex").slice(0, 32);
}

// Secondary dedup: same venue + same start hour. Catches cross-source events
// where titles differ but it's clearly the same gig. Hour precision is
// deliberate — day precision would falsely merge the 7pm class with the 9pm
// social at the same venue.
//
// Returns null when the venue isn't useful for a key (empty or too short
// after normalization). Without a venue we fall back to canonicalKey only.
export function normalizeVenueForKey(venue: string): string {
  return venue
    .normalize("NFC")
    .toLowerCase()
    // Strip generic location-type words that vary across sources
    .replace(/\b(bar|club|studio|hall|cafe|lounge|center|centre)\b/gi, "")
    // Collapse non-alphanumeric (incl. CJK punctuation) to single space
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function computeVenueDateKey(
  venue: string | null | undefined,
  startAt: Date | string,
): string | null {
  if (!venue) return null;
  const v = normalizeVenueForKey(venue);
  // Require at least 3 characters of meaningful venue text — single-letter or
  // empty post-normalization isn't a useful dedup signal.
  if (v.length < 3) return null;
  // Hour precision: YYYY-MM-DDTHH (in UTC; close enough across sources that
  // would all be reporting the same wall-clock hour in JST).
  const hour = (startAt instanceof Date ? startAt : new Date(startAt))
    .toISOString()
    .slice(0, 13);
  return createHash("sha256").update(`${v}|${hour}`).digest("hex").slice(0, 32);
}
