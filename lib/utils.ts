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
