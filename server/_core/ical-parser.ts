import ICAL from "ical.js";
import type { ScrapedEvent } from "../scraper";
import type { DanceStyle, EventType } from "../../shared/constants";

// ─── iCal → ScrapedEvent ────────────────────────────────────────────────────
//
// Parses a public iCal feed (Google Calendar, Meetup, etc.) into our scraper's
// ScrapedEvent shape. Unlike the HTML adapter, this path is fully deterministic
// — no LLM call, no prompt drift. The only "smarts" are:
//
//   1. RRULE expansion (recurring events get exploded into concrete occurrences
//      across a configurable forward window)
//   2. Dance-style classification via regex (title first, description as
//      fallback; preserves Latin-script and Japanese-katakana spellings)
//   3. Location parsing (split SUMMARY-style "venue, address, country" strings)
//   4. City extraction from an address (Tokyo / Osaka / etc.)
//
// Known data-loss policies (intentional):
//
//   • Events with STATUS:CANCELLED are dropped.
//   • All-day events (VALUE=DATE on DTSTART) are dropped — including legitimate
//     multi-day festivals published as VALUE=DATE/VALUE=DATE. We don't guess at
//     a default time; an organiser publishing a festival in iCal should include
//     a DTSTART with a time component. If we start losing real festivals, the
//     fix is to parse VALUE=DATE intervals into a single all-day event row,
//     not to default to an arbitrary evening time.
//   • RRULE expansion has a fixed safety counter (5000 iterations). Pattern
//     denser than ~daily over many years would trip it; we log a warning when
//     it does, but the missing occurrences are silent in the DB.

const DEFAULT_WINDOW_DAYS = 60;

// Style probe order = community frequency. First match wins, both in title
// and (as fallback) in description. Title is searched first so a "Salsa Night
// w/ bachata after 11" gets classified as salsa, not bachata.
//
// Word-boundary `\b` is applied to the Latin alternatives so "Tutango" doesn't
// match `tango`, "salsamento" doesn't match `salsa`, etc. We don't apply `\b`
// to the Japanese alternatives because JavaScript's `\b` is ASCII-only —
// katakana characters aren't word chars from its perspective, so `\bサルサ\b`
// would never match. Katakana spellings don't have substring problems anyway.
const STYLE_PATTERNS: Array<[DanceStyle, RegExp]> = [
  ["salsa", /(\bsalsa\b|サルサ)/i],
  ["bachata", /(\bbachata\b|バチャータ)/i],
  ["zouk", /(\bzouk\b|ズーク|ザウク)/i],
  ["kizomba", /(\bkizomba\b|キゾンバ)/i],
  ["tango", /(\btango\b|タンゴ)/i],
  ["cha-cha-cha", /(\bcha[\s-]?cha[\s-]?cha?\b|チャチャチャ)/i],
  ["merengue", /(\bmerengue\b|メレンゲ)/i],
  ["cumbia", /(\bcumbia\b|クンビア)/i],
  ["samba", /(\bsamba\b|サンバ)/i],
  ["reggaeton", /(\breggaet[oó]n\b|レゲトン)/i],
  ["mambo", /(\bmambo\b|マンボ)/i],
  ["rumba", /(\brumba\b|ルンバ)/i],
  ["afro-latin", /(\bafro[\s-]?latin\b)/i],
];

export function classifyDanceStyle(title: string, description: string): DanceStyle {
  // Title-first: a single hit in the title beats any number in the description.
  for (const [style, pattern] of STYLE_PATTERNS) {
    if (pattern.test(title)) return style;
  }
  for (const [style, pattern] of STYLE_PATTERNS) {
    if (pattern.test(description)) return style;
  }
  // No recognizable style — multi-style ambiguous events land here too.
  return "mixed";
}

// Event-type heuristics. Order matters: more specific patterns first so that
// "Salsa Workshop Festival" lands on `festival` rather than `workshop`. The
// existing schema enum is the source of truth — anything not on this list is
// `null` (unknown) rather than fabricated.
const EVENT_TYPE_PATTERNS: Array<[EventType, RegExp]> = [
  ["festival", /(\bfestival\b|フェスティバル|フェス)/i],
  ["congress", /(\bcongress\b|コングレス)/i],
  ["bootcamp", /(\bbootcamp\b|ブートキャンプ|集中レッスン)/i],
  ["workshop", /(\bworkshop\b|ワークショップ|wkshp)/i],
  ["performance", /(\bperformance\b|\bshow\b|パフォーマンス|ショー|発表会)/i],
  ["class", /(\bclass\b|\blesson\b|レッスン|クラス|教室)/i],
  ["social", /(\bsocial\b|\bparty\b|\bnight\b|\bfiesta\b|\bmilonga\b|ソーシャル|パーティー)/i],
];

export function classifyEventType(
  title: string,
  description: string,
): EventType | null {
  // Title takes precedence; description is fallback. Same logic as dance style.
  for (const [type, pattern] of EVENT_TYPE_PATTERNS) {
    if (pattern.test(title)) return type;
  }
  for (const [type, pattern] of EVENT_TYPE_PATTERNS) {
    if (pattern.test(description)) return type;
  }
  return null;
}

// Cities the scraper covers. Add more here when expanding region.
const CITY_PATTERNS: Array<[string, RegExp]> = [
  ["Tokyo", /(東京|tokyo)/i],
  ["Osaka", /(大阪|osaka)/i],
  ["Yokohama", /(横浜|yokohama)/i],
  ["Nagoya", /(名古屋|nagoya)/i],
  ["Kyoto", /(京都|kyoto)/i],
  ["Fukuoka", /(福岡|fukuoka)/i],
  ["Sapporo", /(札幌|sapporo)/i],
  ["Kobe", /(神戸|kobe)/i],
  ["Okinawa", /(沖縄|okinawa)/i],
];

export function extractCity(text: string): string | undefined {
  if (!text) return undefined;
  for (const [name, pattern] of CITY_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return undefined;
}

// Google Calendar public iCal feeds carry no per-event web page, so events
// from them would fall back to the raw .ics URL as their sourceUrl — which
// browsers treat as "subscribe to calendar", making it awkward to verify an
// event. The same calendar has a browser-viewable embed page that accepts a
// day deep-link; point sourceUrl there instead.
export function googleCalendarDayUrl(feedUrl: string, startAtIso: string): string | null {
  const m = feedUrl.match(
    /^https:\/\/calendar\.google\.com\/calendar\/ical\/([^/]+)\/public\/[^/]+\.ics$/i,
  );
  if (!m) return null;
  const start = new Date(startAtIso);
  if (Number.isNaN(start.getTime())) return null;
  // Day boundary in JST — the calendars this app scrapes are Japan-local.
  const jstDay = new Date(start.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  // The feed URL may carry the calendar id raw (@) or percent-encoded (%40);
  // normalize before re-encoding for the query string.
  const calendarId = encodeURIComponent(decodeURIComponent(m[1]));
  return (
    `https://calendar.google.com/calendar/embed?src=${calendarId}` +
    `&ctz=Asia%2FTokyo&mode=DAY&dates=${jstDay}%2F${jstDay}`
  );
}

// Google Calendar (and other sources) embed HTML in DESCRIPTION — literal
// <p>/<br> tags and entities that render as gibberish in the app. Convert to
// plain text, but only when the input actually looks like markup: running
// tag-stripping on genuine plain text would mangle strings like "I <3 salsa".
export function htmlToPlainText(input: string): string {
  if (!/<\/?[a-z][a-z0-9]*\b[^>]*>/i.test(input)) return input;

  return (
    input
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      // Paragraph ends become blank lines; list items become bullets.
      .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
      .replace(/<\s*\/\s*(div|li|h[1-6]|tr)\s*>/gi, "\n")
      .replace(/<\s*li\b[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, "")
      // Entity decoding — &amp; strictly last, or "&amp;lt;" would
      // double-decode into a stray "<".
      .replace(/&nbsp;/gi, " ")
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;/g, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&")
      // Collapse the whitespace debris tag removal leaves behind.
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// iCal LOCATION is a single string with no internal structure, but Google
// Calendar formats it as "Venue Name, Address parts, Country" with mixed
// commas (Western and Japanese fullwidth `、`).
export function parseLocation(raw: string | null | undefined): {
  venueName?: string;
  venueAddress?: string;
  city?: string;
} {
  if (!raw) return {};
  const parts = raw
    .split(/[,、]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) {
    return { venueAddress: parts[0], city: extractCity(parts[0]) };
  }
  const venueName = parts[0];
  const addressParts = parts.slice(1).filter((p) => !/^日本$|^japan$/i.test(p));
  const venueAddress = addressParts.join(", ");
  return {
    venueName,
    venueAddress: venueAddress || undefined,
    city: extractCity(venueAddress),
  };
}

// Only http(s) URLs are safe to store as sourceUrl. Mirrors lib/utils.ts but
// kept inline here so server code doesn't import the RN/lib tree.
function isSafeUrl(input: unknown): input is string {
  if (typeof input !== "string" || input.length === 0) return false;
  try {
    const u = new URL(input);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

interface ParseIcalOptions {
  /** "Now" reference for the recurrence window. Tests inject this. */
  now?: Date;
  /** How far ahead to expand RRULEs. Default 60 days. */
  windowDays?: number;
}

export function parseIcal(
  icalText: string,
  options: ParseIcalOptions = {},
): ScrapedEvent[] {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const windowStart = now.getTime();
  const windowEnd = windowStart + windowDays * 24 * 60 * 60 * 1000;

  let vevents: ICAL.Component[];
  try {
    const jcal = ICAL.parse(icalText);
    const root = new ICAL.Component(jcal);
    vevents = root.getAllSubcomponents("vevent");
  } catch (err: any) {
    console.warn(`[Scraper:iCal] Failed to parse: ${err.message}`);
    return [];
  }
  if (!Array.isArray(vevents) || vevents.length === 0) return [];

  const events: ScrapedEvent[] = [];

  for (const vevent of vevents) {
    let event: ICAL.Event;
    try {
      event = new ICAL.Event(vevent);
    } catch {
      continue;
    }

    // Skip cancelled events. iCal STATUS=CANCELLED is the canonical signal
    // that an event was scheduled and then withdrawn; ingesting it would
    // surface phantom entries in the calendar.
    const status = (vevent.getFirstPropertyValue("status") as string | null) ?? "";
    if (status === "CANCELLED") continue;

    // Defensive truncation: events.title is varchar(500). Out-of-spec feeds
    // with massive summaries would otherwise fail the insert.
    const summary = (event.summary ?? "").trim().slice(0, 500);
    if (!summary) continue;

    // All-day events (VALUE=DATE) have no specific time. See header comment
    // for the trade-off — `warn` not `log` because this is a documented but
    // non-trivial data-loss policy worth surfacing in production logs.
    if (event.startDate?.isDate) {
      console.warn(
        `[Scraper:iCal] Skipping all-day event "${(event.summary ?? "").trim()}" — ` +
          `VALUE=DATE entries are dropped (no start time).`,
      );
      continue;
    }

    const description = htmlToPlainText((event.description ?? "").trim());
    const location = (event.location ?? "").trim();
    const url = (vevent.getFirstPropertyValue("url") as string | null) ?? null;
    const uid = event.uid ?? null;

    const danceStyle = classifyDanceStyle(summary, description);
    const eventType = classifyEventType(summary, description);
    const loc = parseLocation(location);

    // Recurring events: expand into concrete occurrences inside the window.
    // Non-recurring: just the single instance, if it falls in the window.
    if (event.isRecurring()) {
      // ICAL.RecurExpansion produces ICAL.Time instances we then convert.
      let iter: ICAL.RecurExpansion;
      try {
        iter = event.iterator();
      } catch {
        continue;
      }
      // Pre-compute the per-occurrence duration. Prefer event.duration when
      // available; fall back to (DTEND - DTSTART) when only an endDate was set
      // (a feed using DTEND on a recurring event would otherwise lose endAt
      // on every expansion). 0 means "no end time".
      let durationMs = (event.duration?.toSeconds?.() ?? 0) * 1000;
      if (durationMs <= 0 && event.startDate && event.endDate) {
        const startMs = event.startDate.toJSDate().getTime();
        const endMs = event.endDate.toJSDate().getTime();
        if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
          durationMs = endMs - startMs;
        }
      }
      let next = iter.next();
      const SAFETY_LIMIT = 5000;
      let safety = SAFETY_LIMIT;
      while (next && safety-- > 0) {
        const start = next.toJSDate();
        if (start.getTime() > windowEnd) break;
        if (start.getTime() >= windowStart) {
          const end = durationMs > 0 ? new Date(start.getTime() + durationMs) : null;
          events.push({
            externalId: uid ? `${uid}@${start.toISOString()}` : undefined,
            title: summary,
            description: description || undefined,
            danceStyle,
            eventType: eventType ?? undefined,
            startAt: start.toISOString(),
            endAt: end?.toISOString() ?? undefined,
            venueName: loc.venueName,
            venueAddress: loc.venueAddress,
            city: loc.city,
            sourceUrl: isSafeUrl(url) ? url : undefined,
          });
        }
        next = iter.next();
      }
      // If we walked the entire safety budget without breaking out via the
      // windowEnd check, we may have missed legitimate occurrences. Log loudly
      // so we notice — for FREQ=HOURLY or shorter, the budget is too small.
      if (safety <= 0) {
        console.warn(
          `[Scraper:iCal] Safety counter (${SAFETY_LIMIT}) exhausted while expanding ` +
            `RRULE for "${summary}". Some occurrences in the window may be missing.`,
        );
      }
    } else {
      const start = event.startDate?.toJSDate();
      if (!start) continue;
      if (start.getTime() < windowStart || start.getTime() > windowEnd) continue;
      const end = event.endDate?.toJSDate();
      events.push({
        externalId: uid ?? undefined,
        title: summary,
        description: description || undefined,
        danceStyle,
        eventType: eventType ?? undefined,
        startAt: start.toISOString(),
        endAt: end?.toISOString() ?? undefined,
        venueName: loc.venueName,
        venueAddress: loc.venueAddress,
        city: loc.city,
        sourceUrl: isSafeUrl(url) ? url : undefined,
      });
    }
  }

  return events;
}
