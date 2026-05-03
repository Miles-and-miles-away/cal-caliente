/**
 * Shared application constants.
 * All magic strings, numbers, and configuration values are centralized here.
 * Import from "@/shared/constants" in both frontend and backend.
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

export const DANCE_STYLE_OPTIONS: readonly { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Salsa", value: "salsa" },
  { label: "Bachata", value: "bachata" },
  { label: "Zouk", value: "zouk" },
  { label: "Kizomba", value: "kizomba" },
  { label: "Merengue", value: "merengue" },
  { label: "Cha-Cha-Cha", value: "cha-cha-cha" },
  { label: "Cumbia", value: "cumbia" },
  { label: "Reggaeton", value: "reggaeton" },
  { label: "Samba", value: "samba" },
  { label: "Tango", value: "tango" },
  { label: "Rumba", value: "rumba" },
  { label: "Mambo", value: "mambo" },
  { label: "Afro-Latin", value: "afro-latin" },
  { label: "Mixed", value: "mixed" },
  { label: "Other", value: "other" },
] as const;

export const DANCE_STYLE_COLORS: Readonly<Record<string, string>> = {
  salsa: "#E53E3E",
  bachata: "#805AD5",
  zouk: "#3182CE",
  kizomba: "#D69E2E",
  merengue: "#38A169",
  "cha-cha-cha": "#DD6B20",
  cumbia: "#E53E8E",
  reggaeton: "#2B6CB0",
  samba: "#F6AD55",
  tango: "#C53030",
  rumba: "#9F7AEA",
  mambo: "#ED64A6",
  "afro-latin": "#2C7A7B",
  mixed: "#718096",
  other: "#A0AEC0",
} as const;

export const DANCE_STYLE_LABELS: Readonly<Record<string, string>> = {
  salsa: "Salsa",
  bachata: "Bachata",
  zouk: "Zouk",
  kizomba: "Kizomba",
  merengue: "Merengue",
  "cha-cha-cha": "Cha-Cha-Cha",
  cumbia: "Cumbia",
  reggaeton: "Reggaeton",
  samba: "Samba",
  tango: "Tango",
  rumba: "Rumba",
  mambo: "Mambo",
  "afro-latin": "Afro-Latin",
  mixed: "Mixed",
  other: "Other",
} as const;

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

export const EVENT_TYPE_OPTIONS: readonly { label: string; value: string }[] = [
  { label: "Social", value: "social" },
  { label: "Workshop", value: "workshop" },
  { label: "Performance", value: "performance" },
  { label: "Festival", value: "festival" },
  { label: "Class", value: "class" },
  { label: "Congress", value: "congress" },
  { label: "Bootcamp", value: "bootcamp" },
] as const;

export const EVENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  social: "Social Dance",
  workshop: "Workshop",
  performance: "Performance",
  festival: "Festival",
  class: "Class",
  congress: "Congress",
  bootcamp: "Bootcamp",
  other: "Other",
} as const;

// ─── Source Types ────────────────────────────────────────────────────────────

export type SourceType = "facebook" | "instagram" | "rss" | "html" | "custom";

export const SOURCE_TYPE_OPTIONS: readonly SourceType[] = [
  "facebook",
  "instagram",
  "rss",
  "html",
  "custom",
] as const;

export const SOURCE_TYPE_LABELS: Readonly<Record<SourceType, string>> = {
  facebook: "Facebook",
  instagram: "Instagram",
  rss: "RSS / iCal",
  html: "Website",
  custom: "Custom",
} as const;

export const SOURCE_TYPE_ICONS: Readonly<Record<SourceType, string>> = {
  facebook: "📘",
  instagram: "📸",
  rss: "📡",
  html: "🌐",
  custom: "🔧",
} as const;

// ─── Japan Cities ────────────────────────────────────────────────────────────

export const JAPAN_CITIES: readonly { label: string; value: string }[] = [
  { label: "All Cities", value: "" },
  { label: "Tokyo", value: "Tokyo" },
  { label: "Osaka", value: "Osaka" },
  { label: "Nagoya", value: "Nagoya" },
  { label: "Fukuoka", value: "Fukuoka" },
  { label: "Yokohama", value: "Yokohama" },
  { label: "Kobe", value: "Kobe" },
  { label: "Sapporo", value: "Sapporo" },
  { label: "Kyoto", value: "Kyoto" },
  { label: "Sendai", value: "Sendai" },
  { label: "Hiroshima", value: "Hiroshima" },
  { label: "Okinawa", value: "Okinawa" },
] as const;

// ─── Date Ranges ─────────────────────────────────────────────────────────────

export const DATE_RANGE_OPTIONS: readonly { label: string; value: string }[] = [
  { label: "Upcoming", value: "upcoming" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "Past Month", value: "past_month" },
  { label: "Custom", value: "custom" },
  { label: "All", value: "all" },
] as const;

// ─── Map Defaults ────────────────────────────────────────────────────────────

export const DEFAULT_MAP_REGION = {
  latitude: 35.6762,
  longitude: 139.6503,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
} as const;

// ─── Preferences Defaults ────────────────────────────────────────────────────

export const DEFAULT_PREFERENCES = {
  city: "Tokyo",
  maxDistanceKm: 30,
  nearestStation: "",
  maxWalkMinutes: 15,
  danceStyles: [
    "salsa", "bachata", "zouk", "kizomba", "merengue",
    "cha-cha-cha", "cumbia", "reggaeton", "samba", "tango",
    "rumba", "mambo", "afro-latin", "mixed",
  ] as string[],
  eventTypes: [
    "social", "workshop", "festival", "class",
    "congress", "performance", "bootcamp",
  ] as string[],
  notificationsEnabled: true,
} as const;

export const DISTANCE_OPTIONS_KM = [5, 10, 15, 20, 30, 50, 100] as const;
export const WALK_TIME_OPTIONS_MIN = [5, 10, 15, 20, 30] as const;

// ─── Scraper Configuration ───────────────────────────────────────────────────

export const SCRAPER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
export const SCRAPER_INITIAL_DELAY_MS = 5_000; // 5 seconds after server start
export const SCRAPER_FETCH_TIMEOUT_MS = 15_000; // 15 seconds per source fetch
export const SCRAPER_USER_AGENT =
  "Mozilla/5.0 (compatible; SalsaBachataCalendar/1.0; +https://salsabachatajapan.app)";
// 100k chars (~25k tokens) is a comfortable fit inside Gemini Flash's 1M
// context. Higher than this and we start spending real money per scrape;
// lower and we cut off SalsaVida city pages mid-month.
export const SCRAPER_MAX_HTML_CHARS = 100_000;

// ─── API Limits ──────────────────────────────────────────────────────────────

export const API_DEFAULT_PAGE_SIZE = 100;
export const API_MAX_PAGE_SIZE = 500;
export const API_EVENT_LOOKAHEAD_DAYS = 60;
export const API_EVENT_LOOKBACK_DAYS = 30;

// ─── Storage Keys ────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  PREFERENCES: "@salsa_prefs",
  FAVORITES: "@salsa_favorites",
  LAST_CITY: "@salsa_last_city",
} as const;

// ─── URL Validation ──────────────────────────────────────────────────────────

export const ALLOWED_URL_PROTOCOLS = ["https:", "http:"] as const;
export const MAX_URL_LENGTH = 2048;
export const MAX_SOURCE_NAME_LENGTH = 255;

// ─── App Metadata ────────────────────────────────────────────────────────────

export const APP_VERSION = "1.0.0";
export const APP_REGION = "Japan";
