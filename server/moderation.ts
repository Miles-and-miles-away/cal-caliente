/**
 * Content moderation utilities for user-generated content.
 * Handles automatic profanity filtering and moderation status determination.
 */

import { PROFANITY_FILTER_WORDS, PROFANITY_FILTER_ENABLED } from "@/shared/constants";

/**
 * Check if text contains profanity
 */
export function containsProfanity(text: string): boolean {
  if (!PROFANITY_FILTER_ENABLED || !text) return false;

  const lowerText = text.toLowerCase();
  return PROFANITY_FILTER_WORDS.some((word) => {
    // Match whole words only (word boundaries)
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    return regex.test(lowerText);
  });
}

/**
 * Sanitize text by replacing profanity with asterisks
 */
export function sanitizeText(text: string): string {
  if (!PROFANITY_FILTER_ENABLED || !text) return text;

  let sanitized = text;
  PROFANITY_FILTER_WORDS.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const replacement = "*".repeat(word.length);
    sanitized = sanitized.replace(regex, replacement);
  });
  return sanitized;
}

/**
 * Determine moderation status based on content analysis
 * Returns: "approved" if content is clean, "pending" if needs review
 */
export function determineModerationStatus(
  title: string,
  description?: string
): "approved" | "pending" {
  const fullText = `${title} ${description || ""}`;

  // Check for profanity
  if (containsProfanity(fullText)) {
    return "pending";
  }

  // Check for suspicious patterns (spam indicators)
  const suspiciousPatterns = [
    /\b(click\s+here|buy\s+now|limited\s+offer)\b/gi, // Spam keywords
    /https?:\/\/[^\s]+/g, // Multiple URLs
  ];

  let urlCount = 0;
  suspiciousPatterns.forEach((pattern) => {
    if (pattern.test(fullText)) {
      if (pattern.source.includes("https")) {
        urlCount++;
      } else {
        return "pending";
      }
    }
  });

  // Flag if too many URLs
  if (urlCount > 2) {
    return "pending";
  }

  return "approved";
}

/**
 * Get flagged reason if content should be flagged
 */
export function getFlaggedReason(
  title: string,
  description?: string
): string | null {
  const fullText = `${title} ${description || ""}`;

  if (containsProfanity(fullText)) {
    return "profanity";
  }

  return null;
}
