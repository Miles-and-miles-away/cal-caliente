/**
 * Shared constants, ported from the old RN app's shared/constants.ts.
 * Enum values MUST stay in sync with SCHEMA.md and lib/core/constants.dart.
 */

// ─── Dance Styles ────────────────────────────────────────────────────────────

export const DANCE_STYLES = [
  "salsa",
  "bachata",
  "zouk",
  "kizomba",
  "merengue",
  "cha-cha-cha",
  "cumbia",
  "reggaeton",
  "samba",
  "tango",
  "rumba",
  "mambo",
  "afro-latin",
  "mixed",
  "other",
] as const;

export type DanceStyle = (typeof DANCE_STYLES)[number];

// ─── Event Types ─────────────────────────────────────────────────────────────

export const EVENT_TYPES = [
  "social",
  "workshop",
  "performance",
  "festival",
  "class",
  "congress",
  "bootcamp",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// ─── Source Types ────────────────────────────────────────────────────────────

export const SOURCE_TYPES = [
  "facebook",
  "instagram",
  "rss",
  "html",
  "custom",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

// ─── Japan Cities ────────────────────────────────────────────────────────────
// The 11 selectable cities (the app's picker also has an "" = All entry, which
// is a filter value, not a storable event city).

export const JAPAN_CITY_VALUES = [
  "Tokyo",
  "Osaka",
  "Nagoya",
  "Fukuoka",
  "Yokohama",
  "Kobe",
  "Sapporo",
  "Kyoto",
  "Sendai",
  "Hiroshima",
  "Okinawa",
] as const;

// ─── Scraper ─────────────────────────────────────────────────────────────────

export const SCRAPER_FETCH_TIMEOUT_MS = 15_000; // 15 seconds per source fetch
export const SCRAPER_USER_AGENT =
  "Mozilla/5.0 (compatible; CalCaliente/1.0; +https://github.com/Miles-and-miles-away/cal-caliente)";
// 100k chars (~25k tokens) is a comfortable fit inside Gemini Flash's 1M
// context. Higher than this and we start spending real money per scrape;
// lower and we cut off SalsaVida city pages mid-month.
export const SCRAPER_MAX_HTML_CHARS = 100_000;

// ─── URL Validation ──────────────────────────────────────────────────────────

export const ALLOWED_URL_PROTOCOLS = ["https:", "http:"] as const;

// ─── App Check ───────────────────────────────────────────────────────────────
// Enforce App Check on the callables only when ENFORCE_APP_CHECK=true (set in
// functions/.env, same mechanism as GEMINI_API_KEY). Default off so deploys
// never reject clients that predate App Check — flip it on once every client
// ships tokens and the apps are registered in the Firebase console.
export const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === "true";
export const MAX_URL_LENGTH = 2048;
// Kept at the old MySQL-era bound (768) so seeded sources stay compatible.
export const MAX_SOURCE_URL_LENGTH = 768;
export const MAX_SOURCE_NAME_LENGTH = 255;
