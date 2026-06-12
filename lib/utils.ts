import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge.
 * This ensures Tailwind classes are properly merged without conflicts.
 *
 * Usage:
 * ```tsx
 * cn("px-4 py-2", isActive && "bg-primary", className)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Only http(s) URLs are safe to hand to Linking.openURL. Scraped event data
// is attacker-influenced; without this check, a crafted source could supply
// `javascript:`, `intent://`, or custom-scheme URLs that hijack the user.
export function isSafeExternalUrl(input: unknown): input is string {
  if (typeof input !== "string" || input.length === 0) return false;
  try {
    const u = new URL(input);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Build a JST ISO-8601 string from a `YYYY-MM-DD` date and `HH:mm` time. Events
// in this app are stored with the +09:00 offset. Returns null if either part is
// malformed so the caller can show a validation message.
export function buildJstIso(dateStr: string, timeStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const iso = `${dateStr}T${timeStr}:00+09:00`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}
