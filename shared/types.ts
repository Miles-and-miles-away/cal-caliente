/**
 * Unified type and constant exports.
 * Import shared types and constants from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";
export * from "./constants";

// ─── API Request / Response Types ────────────────────────────────────────────

export interface EventListParams {
  danceStyle?: string;
  eventType?: string;
  city?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SourceAddParams {
  name: string;
  url: string;
  sourceType: "facebook" | "instagram" | "rss" | "html" | "custom";
}

export interface PreferencesUpdateParams {
  city?: string;
  prefecture?: string;
  maxDistanceKm?: number;
  nearestStation?: string;
  maxWalkMinutes?: number;
  danceStyles?: string[];
  eventTypes?: string[];
  notificationsEnabled?: boolean;
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

export function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatEventTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
