/**
 * Shared application constants.
 * All magic strings, numbers, and configuration values are centralized here.
 * Import from "@/shared/constants" in both frontend and backend.
 */

// ─── Dance Styles ────────────────────────────────────────────────────────────

export type DanceStyle = "salsa" | "bachata" | "both";
export type DanceStyleOrOther = DanceStyle | "other";

export const DANCE_STYLE_OPTIONS: readonly { label: string; value: DanceStyle | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Salsa", value: "salsa" },
  { label: "Bachata", value: "bachata" },
  { label: "Both", value: "both" },
] as const;

export const DANCE_STYLE_COLORS: Readonly<Record<string, string>> = {
  salsa: "#E8003D",
  bachata: "#FF6B35",
  both: "#FFD700",
  other: "#6B7280",
} as const;

export const DANCE_STYLE_LABELS: Readonly<Record<string, string>> = {
  salsa: "Salsa",
  bachata: "Bachata",
  both: "Salsa & Bachata",
  other: "Other",
} as const;

// ─── Event Types ─────────────────────────────────────────────────────────────

export type EventType = "social" | "workshop" | "performance" | "festival" | "class" | "other";

export const EVENT_TYPE_OPTIONS: readonly { label: string; value: EventType }[] = [
  { label: "Social", value: "social" },
  { label: "Workshop", value: "workshop" },
  { label: "Performance", value: "performance" },
  { label: "Festival", value: "festival" },
  { label: "Class", value: "class" },
] as const;

export const EVENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  social: "Social",
  workshop: "Workshop",
  performance: "Performance",
  festival: "Festival",
  class: "Class",
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
] as const;

// ─── Date Ranges ─────────────────────────────────────────────────────────────

export const DATE_RANGE_OPTIONS: readonly { label: string; value: string }[] = [
  { label: "Upcoming", value: "upcoming" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
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
  danceStyleFilter: "both" as DanceStyle,
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
export const SCRAPER_MAX_HTML_CHARS = 30_000; // Max chars sent to LLM for parsing

// ─── API Limits ──────────────────────────────────────────────────────────────

export const API_DEFAULT_PAGE_SIZE = 100;
export const API_MAX_PAGE_SIZE = 500;
export const API_EVENT_LOOKAHEAD_DAYS = 60;

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
