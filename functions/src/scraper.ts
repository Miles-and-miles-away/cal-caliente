/**
 * Event Scraper Engine — Firestore edition.
 *
 * Adapter-based scraping framework ported from the old server/scraper.ts.
 * Each adapter implements the ScraperAdapter interface. The scheduled
 * function runs all active sources daily; scrapeNow runs them on demand.
 *
 * Security:
 * - All URLs are validated before fetching (SSRF-guarded safeFetch)
 * - HTML content is truncated before LLM processing
 * - Fetch requests have strict timeouts
 * - User-agent is clearly identified
 *
 * Deliberately dropped vs. the old server (see SCHEMA.md):
 * - Facebook/Instagram adapters (were token-gated stubs; sources of those
 *   types are skipped with a log line)
 * - Detail-page enrichment pass cut — the old scraper re-fetched
 *   sparse events' detail pages for a second LLM pass (address/coords).
 *   Listing-page extraction alone is good enough to relaunch; revisit if
 *   map pins prove too sparse.
 * - geocode backfill (no geocoding service wired up yet)
 */

import { FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { extractEventsFromHtml } from "./eventExtractor";
import { googleCalendarDayUrl, parseIcal } from "./icalParser";
import { computeCanonicalKey, computeVenueDateKey } from "./keys";
import { safeFetch, sanitizeUrl } from "./safeFetch";
import type { ScrapedEvent, ScraperAdapter } from "./types";
import {
  SCRAPER_FETCH_TIMEOUT_MS,
  SCRAPER_MAX_HTML_CHARS,
  SCRAPER_USER_AGENT,
} from "./constants";

// ─── HTML Adapter (Gemini Flash extraction) ──────────────────────────────────

export class HtmlScraperAdapter implements ScraperAdapter {
  readonly type = "html";

  canHandle(sourceType: string): boolean {
    return sourceType === "html" || sourceType === "custom";
  }

  async scrape(url: string, sourceName: string): Promise<ScrapedEvent[]> {
    const sanitized = sanitizeUrl(url);
    if (!sanitized) {
      logger.warn(`[Scraper:HTML] Invalid URL: ${url}`);
      return [];
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SCRAPER_FETCH_TIMEOUT_MS);

      const response = await safeFetch(sanitized, {
        headers: { "User-Agent": SCRAPER_USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        logger.warn(`[Scraper:HTML] HTTP ${response.status} for ${sanitized}`);
        return [];
      }

      const html = await response.text();
      const truncated = html.slice(0, SCRAPER_MAX_HTML_CHARS);

      const events = await extractEventsFromHtml({
        html: truncated,
        sourceUrl: sanitized,
        sourceName,
        now: new Date(),
      });
      logger.info(`[Scraper:HTML] Extracted ${events.length} events from ${sanitized}`);
      return events;
    } catch (error) {
      const err = error as Error;
      if (err.name === "AbortError") {
        logger.warn(`[Scraper:HTML] Timeout fetching ${sanitized}`);
      } else {
        logger.warn(`[Scraper:HTML] Error: ${err.message}`);
      }
      return [];
    }
  }
}

// ─── iCal Adapter ────────────────────────────────────────────────────────────
//
// The `rss` source type covers iCal feeds (Google Calendar, Meetup, etc.).
// Pure deterministic parsing — no LLM call, no prompt drift. RRULE expansion
// produces concrete occurrences over the next 60 days.

export class RssScraperAdapter implements ScraperAdapter {
  readonly type = "rss";

  canHandle(sourceType: string): boolean {
    return sourceType === "rss";
  }

  async scrape(url: string, _sourceName: string): Promise<ScrapedEvent[]> {
    const sanitized = sanitizeUrl(url);
    if (!sanitized) return [];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SCRAPER_FETCH_TIMEOUT_MS);

      const response = await safeFetch(sanitized, {
        headers: {
          "User-Agent": SCRAPER_USER_AGENT,
          // Some calendar hosts (notably Meetup) sniff Accept and serve HTML
          // unless we ask for iCal explicitly.
          Accept: "text/calendar, application/calendar+xml, */*;q=0.5",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        logger.warn(`[Scraper:iCal] HTTP ${response.status} for ${sanitized}`);
        return [];
      }

      const content = await response.text();
      const events = parseIcal(content, { now: new Date() });
      // Events without a per-event URL would fall back to the raw .ics feed
      // as sourceUrl; substitute a browser-viewable calendar day link.
      for (const ev of events) {
        if (!ev.sourceUrl) {
          ev.sourceUrl = googleCalendarDayUrl(sanitized, ev.startAt) ?? undefined;
        }
      }
      logger.info(`[Scraper:iCal] Parsed ${events.length} events from ${sanitized}`);
      return events;
    } catch (error) {
      logger.warn(`[Scraper:iCal] Error: ${(error as Error).message}`);
      return [];
    }
  }
}

// ─── Adapter Registry ────────────────────────────────────────────────────────
// Facebook/Instagram adapters dropped (were token-gated stubs in the old
// server); sources of those types simply find no adapter and are skipped.

const adapters: ScraperAdapter[] = [
  new HtmlScraperAdapter(),
  new RssScraperAdapter(),
];

export function getAdapterForType(sourceType: string): ScraperAdapter | null {
  return adapters.find((a) => a.canHandle(sourceType)) ?? null;
}

// ─── Firestore upsert ────────────────────────────────────────────────────────

export interface SourceRecord {
  id: string;
  name: string;
  url: string;
  sourceType: string;
  /** True for sources added by an app user via registerSource (untrusted);
   *  false for the maintainer-curated defaults seeded into the project. */
  isUserAdded: boolean;
}

/**
 * Insert a scraped event unless it already exists. Doc id = canonicalKey, so
 * title+date dedup is by construction; the venueDateKey query is the second
 * dedup axis (same venue + hour, different title). Existing docs are left
 * untouched (no lastSeen merge — deliberate simplification vs. the old
 * MySQL upsert-and-merge).
 *
 * Returns true when a new doc was created.
 */
async function insertScrapedEvent(
  db: Firestore,
  sourceId: string,
  fallbackSourceUrl: string,
  sourceIsUserAdded: boolean,
  ev: ScrapedEvent,
): Promise<boolean> {
  const startAt = new Date(ev.startAt);
  if (Number.isNaN(startAt.getTime())) {
    throw new Error(`Invalid startAt "${ev.startAt}"`);
  }
  const canonicalKey = computeCanonicalKey(ev.title, startAt);
  const venueDateKey = computeVenueDateKey(ev.venueName, startAt);

  const ref = db.collection("events").doc(canonicalKey);
  const snap = await ref.get();
  if (snap.exists) return false;

  if (venueDateKey) {
    const dupe = await db
      .collection("events")
      .where("venueDateKey", "==", venueDateKey)
      .limit(1)
      .get();
    if (!dupe.empty) return false;
  }

  const now = Timestamp.now();
  const endAt = ev.endAt ? new Date(ev.endAt) : null;
  await ref.create({
    title: ev.title,
    description: ev.description ?? null,
    // SCHEMA.md keeps these non-null; the classifier fallbacks match the
    // old iCal parser's "mixed" default and "unknown → other" for type.
    danceStyle: ev.danceStyle ?? "mixed",
    eventType: ev.eventType ?? "other",
    startAt: Timestamp.fromDate(startAt),
    endAt: endAt && !Number.isNaN(endAt.getTime()) ? Timestamp.fromDate(endAt) : null,
    isAllDay: ev.isAllDay ?? false,
    venueName: ev.venueName ?? null,
    venueAddress: ev.venueAddress ?? null,
    city: ev.city ?? null,
    prefecture: ev.prefecture ?? null,
    latitude: ev.latitude ?? null,
    longitude: ev.longitude ?? null,
    nearestStation: ev.nearestStation ?? null,
    imageUrl: ev.imageUrl ?? null,
    sourceUrl: ev.sourceUrl ?? fallbackSourceUrl,
    price: ev.price ?? null,
    organizer: ev.organizer ?? null,
    sourceId,
    submittedByUid: null,
    // Only maintainer-curated (seeded) sources are auto-trusted. Events from
    // user-registered sources are LLM-extracted from an untrusted page, so they
    // go in unverified and surface in the admin moderation queue (which lists
    // isVerified == false) — same treatment as user form submissions.
    isVerified: !sourceIsUserAdded,
    isCancelled: false,
    canonicalKey,
    venueDateKey,
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

// ─── Scrape Runner ───────────────────────────────────────────────────────────

export async function scrapeSource(
  db: Firestore,
  source: SourceRecord,
): Promise<{ eventsFound: number; eventsAdded: number }> {
  const adapter = getAdapterForType(source.sourceType);
  if (!adapter) {
    logger.warn(`[Scraper] No adapter for source type: ${source.sourceType} (skipping)`);
    return { eventsFound: 0, eventsAdded: 0 };
  }

  const sourceRef = db.collection("sources").doc(source.id);
  const startTime = Date.now();
  let eventsFound = 0;
  let eventsAdded = 0;
  let eventsSkipped = 0;
  let eventsFailed = 0;

  try {
    const scrapedEvents = await adapter.scrape(source.url, source.name);
    eventsFound = scrapedEvents.length;

    for (const ev of scrapedEvents) {
      try {
        const added = await insertScrapedEvent(
          db, source.id, source.url, source.isUserAdded, ev,
        );
        if (added) eventsAdded++;
        else eventsSkipped++;
      } catch (err) {
        eventsFailed++;
        logger.warn(
          `[Scraper] Failed to insert event "${ev.title}": ${(err as Error).message}`,
        );
      }
    }

    await sourceRef.update({ lastScrapedAt: FieldValue.serverTimestamp() });
    await sourceRef.collection("scrapeLogs").add({
      // "partial" only when something actually failed to persist — a clean run
      // where every event was a known duplicate is still a success.
      status: eventsFailed > 0 ? "partial" : "success",
      eventsFound,
      eventsAdded,
      errorMessage: null,
      durationMs: Date.now() - startTime,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (eventsSkipped > 0 || eventsFailed > 0) {
      logger.info(
        `[Scraper] ${source.name}: ${eventsAdded} new, ${eventsSkipped} duplicate, ` +
          `${eventsFailed} failed of ${eventsFound} found`,
      );
    }
  } catch (error) {
    await sourceRef
      .collection("scrapeLogs")
      .add({
        status: "error",
        eventsFound: 0,
        eventsAdded: 0,
        errorMessage: ((error as Error).message ?? "unknown error").slice(0, 500),
        durationMs: Date.now() - startTime,
        createdAt: FieldValue.serverTimestamp(),
      })
      .catch((logErr: Error) =>
        logger.warn(`[Scraper] Failed to write error log: ${logErr.message}`),
      );
  }

  return { eventsFound, eventsAdded };
}

const SCRAPE_CONCURRENCY = 4;

/**
 * Scrape a list of sources with bounded concurrency. Shared code path for the
 * scheduled scrapeSources function and the scrapeNow callable.
 */
export async function runScrape(
  db: Firestore,
  sources: SourceRecord[],
): Promise<{ scraped: number; added: number }> {
  logger.info(`[Scraper] Starting scrape cycle for ${sources.length} sources`);

  let totalFound = 0;
  let totalAdded = 0;

  // Run sources with bounded concurrency. Sequential scraping made one slow
  // source serialize the whole cycle in the old server.
  const queue = [...sources];
  const workers = Array.from(
    { length: Math.min(SCRAPE_CONCURRENCY, queue.length) },
    async () => {
      while (queue.length > 0) {
        const source = queue.shift();
        if (!source) break;
        const result = await scrapeSource(db, source);
        totalFound += result.eventsFound;
        totalAdded += result.eventsAdded;
      }
    },
  );
  await Promise.all(workers);

  logger.info(`[Scraper] Cycle complete: ${totalFound} found, ${totalAdded} added`);
  return { scraped: totalFound, added: totalAdded };
}

export async function getActiveSources(db: Firestore): Promise<SourceRecord[]> {
  const snap = await db.collection("sources").where("isActive", "==", true).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: String(data.name ?? ""),
      url: String(data.url ?? ""),
      sourceType: String(data.sourceType ?? ""),
      isUserAdded: data.isUserAdded === true,
    };
  });
}
