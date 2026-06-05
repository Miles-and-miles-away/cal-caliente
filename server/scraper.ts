/**
 * Event Scraper Engine
 *
 * Adapter-based scraping framework that supports multiple source types.
 * Each adapter implements the ScraperAdapter interface.
 * The scheduler runs all active sources on an hourly interval.
 *
 * Security:
 * - All URLs are validated before fetching
 * - HTML content is truncated before LLM processing
 * - Fetch requests have strict timeouts
 * - User-agent is clearly identified
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { extractEventDetailFromHtml, extractEventsFromHtml } from "./_core/event-extractor";
import { parseIcal } from "./_core/ical-parser";
import {
  getActiveSources,
  addScrapeLog,
  pruneOldScrapeLogs,
  updateSourceScrapedAt,
  upsertEvent,
} from "./db";
import { geocodeMissingEvents } from "./geocode";
import type { InsertEvent } from "../drizzle/schema";
import {
  SCRAPER_INTERVAL_MS,
  SCRAPER_INITIAL_DELAY_MS,
  SCRAPER_FETCH_TIMEOUT_MS,
  SCRAPER_USER_AGENT,
  SCRAPER_MAX_HTML_CHARS,
  ALLOWED_URL_PROTOCOLS,
  MAX_URL_LENGTH,
} from "../shared/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScrapedEvent {
  externalId?: string;
  title: string;
  description?: string;
  danceStyle?: string;
  eventType?: string;
  startAt: string;
  endAt?: string;
  venueName?: string;
  venueAddress?: string;
  city?: string;
  prefecture?: string;
  latitude?: number;
  longitude?: number;
  nearestStation?: string;
  imageUrl?: string;
  sourceUrl?: string;
  price?: string;
  organizer?: string;
}

export interface ScraperAdapter {
  readonly type: string;
  canHandle(sourceType: string): boolean;
  scrape(url: string, sourceName: string): Promise<ScrapedEvent[]>;
}

// ─── URL Validation ──────────────────────────────────────────────────────────

export function isValidScraperUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  if (url.length > MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(url);
    return ALLOWED_URL_PROTOCOLS.includes(parsed.protocol as any);
  } catch {
    return false;
  }
}

export function sanitizeUrl(url: string): string | null {
  if (!isValidScraperUrl(url)) return null;
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

// ─── SSRF protection ────────────────────────────────────────────────────────
// Block requests to private, loopback, link-local, and metadata-service IPs.
// `fetch()` follows redirects by default; we set `redirect: "manual"` and
// re-validate every hop ourselves, otherwise a public URL could redirect to
// `http://169.254.169.254/` (AWS/GCP metadata) and exfiltrate creds.
//
// This check is best-effort against DNS rebinding (the IP can change between
// our lookup and the OS resolver's lookup inside fetch). Mitigations like
// pinning the resolved IP into the request would require a custom HTTPS agent;
// not worth the complexity until we have a real exposure.

const MAX_REDIRECTS = 5;

export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  // IPv4
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10) return true;                              // 10.0.0.0/8
    if (a === 127) return true;                             // loopback
    if (a === 0) return true;                               // 0.0.0.0/8
    if (a === 169 && b === 254) return true;                // link-local + AWS/GCP metadata
    if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                // 192.168.0.0/16
    if (a >= 224) return true;                              // multicast / reserved
    return false;
  }
  // IPv6 — block loopback, link-local, unique-local, IPv4-mapped private ranges
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("fe80:")) return true;                  // link-local
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // unique-local
  if (v6.startsWith("ff")) return true;                     // multicast
  if (v6.startsWith("::ffff:")) {
    // IPv4-mapped IPv6
    const v4 = v6.slice("::ffff:".length);
    return isPrivateIp(v4);
  }
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  // If hostname is itself a literal IP, check directly.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
    if (isPrivateIp(hostname)) throw new Error(`Refusing to fetch private host: ${hostname}`);
    return;
  }
  const results = await dnsLookup(hostname, { all: true });
  for (const r of results) {
    if (isPrivateIp(r.address)) {
      throw new Error(`Refusing to fetch ${hostname} — resolves to private ${r.address}`);
    }
  }
}

export async function safeFetch(initialUrl: string, init: RequestInit = {}): Promise<Response> {
  let url = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(url);
    if (!ALLOWED_URL_PROTOCOLS.includes(parsed.protocol as any)) {
      throw new Error(`Refusing non-http(s) URL: ${parsed.protocol}`);
    }
    await assertPublicHost(parsed.hostname);

    const res = await fetch(url, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      url = new URL(loc, url).toString();
      continue;
    }
    return res;
  }
  throw new Error(`Too many redirects (>${MAX_REDIRECTS})`);
}

// ─── HTML Adapter (stub — ready for LLM integration) ─────────────────────────

export class HtmlScraperAdapter implements ScraperAdapter {
  readonly type = "html";

  canHandle(sourceType: string): boolean {
    return sourceType === "html" || sourceType === "custom";
  }

  async scrape(url: string, sourceName: string): Promise<ScrapedEvent[]> {
    const sanitized = sanitizeUrl(url);
    if (!sanitized) {
      console.warn(`[Scraper:HTML] Invalid URL: ${url}`);
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
        console.warn(`[Scraper:HTML] HTTP ${response.status} for ${sanitized}`);
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
      console.log(`[Scraper:HTML] Extracted ${events.length} events from ${sanitized}`);

      // Detail-page enrichment: for events that came back sparse (missing
      // address or coords) and link to a same-domain detail page, fetch the
      // detail page and run a second LLM pass to fill in the gaps. Capped to
      // protect against runaway LLM cost on first scrape of a busy source.
      const enriched = await enrichEventsBatch(events, sanitized);
      return enriched;
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.warn(`[Scraper:HTML] Timeout fetching ${sanitized}`);
      } else {
        console.warn(`[Scraper:HTML] Error: ${error.message}`);
      }
      return [];
    }
  }
}

// ─── Detail-page enrichment ─────────────────────────────────────────────────

const MAX_ENRICHMENTS_PER_SCRAPE = 50;
const ENRICHMENT_CONCURRENCY = 3;

function needsEnrichment(ev: ScrapedEvent): boolean {
  // Listing pages typically give title/date/venue name. We need address +
  // coordinates for the map to be useful — if both are missing, the detail
  // page is worth a fetch.
  const hasAddress = !!ev.venueAddress;
  const hasCoords = ev.latitude != null && ev.longitude != null;
  return !hasAddress || !hasCoords;
}

function isSameDomain(detailUrl: string, listingUrl: string): boolean {
  try {
    return new URL(detailUrl).host === new URL(listingUrl).host;
  } catch {
    return false;
  }
}

async function enrichOneEvent(
  event: ScrapedEvent,
  listingUrl: string,
): Promise<ScrapedEvent> {
  if (!event.sourceUrl || !isSameDomain(event.sourceUrl, listingUrl)) return event;
  if (!needsEnrichment(event)) return event;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCRAPER_FETCH_TIMEOUT_MS);
    const res = await safeFetch(event.sourceUrl, {
      headers: { "User-Agent": SCRAPER_USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return event;
    const html = (await res.text()).slice(0, SCRAPER_MAX_HTML_CHARS);

    const enrichment = await extractEventDetailFromHtml({
      html,
      pageUrl: event.sourceUrl,
      baseEvent: event,
    });

    // Merge: enrichment fields win when present, base event fields are kept
    // when enrichment returned null/undefined for them.
    const merged: ScrapedEvent = { ...event };
    for (const [key, value] of Object.entries(enrichment)) {
      if (value !== null && value !== undefined && value !== "") {
        (merged as any)[key] = value;
      }
    }
    return merged;
  } catch (err: any) {
    console.warn(`[Scraper:HTML] Enrichment failed for ${event.sourceUrl}: ${err.message}`);
    return event;
  }
}

async function enrichEventsBatch(
  events: ScrapedEvent[],
  listingUrl: string,
): Promise<ScrapedEvent[]> {
  const candidates = events.filter(
    (ev) =>
      ev.sourceUrl &&
      isSameDomain(ev.sourceUrl, listingUrl) &&
      needsEnrichment(ev),
  );
  if (candidates.length === 0) return events;

  // Bound LLM cost per scrape cycle. Subsequent cycles will cover the rest
  // because dedup-by-canonicalKey lets us merge new fields onto existing rows.
  const toEnrich = new Set(candidates.slice(0, MAX_ENRICHMENTS_PER_SCRAPE));
  if (candidates.length > MAX_ENRICHMENTS_PER_SCRAPE) {
    console.log(
      `[Scraper:HTML] Capping enrichment at ${MAX_ENRICHMENTS_PER_SCRAPE}/${candidates.length} ` +
        `for ${listingUrl} — remainder will pick up next cycle.`,
    );
  }

  // Tiny worker pool so we don't fire 50 LLM calls in parallel.
  const queue = events.map((ev, i) => ({ ev, i }));
  const out: ScrapedEvent[] = new Array(events.length);
  const workers = Array.from(
    { length: Math.min(ENRICHMENT_CONCURRENCY, queue.length) },
    async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        out[next.i] = toEnrich.has(next.ev)
          ? await enrichOneEvent(next.ev, listingUrl)
          : next.ev;
      }
    },
  );
  await Promise.all(workers);
  return out;
}

// ─── Facebook Adapter (stub — requires Graph API token) ──────────────────────

export class FacebookScraperAdapter implements ScraperAdapter {
  readonly type = "facebook";

  canHandle(sourceType: string): boolean {
    return sourceType === "facebook";
  }

  async scrape(url: string, _sourceName: string): Promise<ScrapedEvent[]> {
    const sanitized = sanitizeUrl(url);
    if (!sanitized) return [];

    const fbToken = process.env.FACEBOOK_GRAPH_API_TOKEN;
    if (!fbToken) {
      console.log("[Scraper:Facebook] No FACEBOOK_GRAPH_API_TOKEN configured, skipping");
      return [];
    }

    // TODO: Implement Facebook Graph API event fetching
    console.log(`[Scraper:Facebook] Would scrape ${sanitized} (API integration pending)`);
    return [];
  }
}

// ─── Instagram Adapter (stub — requires Graph API token) ─────────────────────

export class InstagramScraperAdapter implements ScraperAdapter {
  readonly type = "instagram";

  canHandle(sourceType: string): boolean {
    return sourceType === "instagram";
  }

  async scrape(url: string, _sourceName: string): Promise<ScrapedEvent[]> {
    const sanitized = sanitizeUrl(url);
    if (!sanitized) return [];

    const igToken = process.env.INSTAGRAM_GRAPH_API_TOKEN;
    if (!igToken) {
      console.log("[Scraper:Instagram] No INSTAGRAM_GRAPH_API_TOKEN configured, skipping");
      return [];
    }

    // TODO: Implement Instagram Graph API post fetching
    console.log(`[Scraper:Instagram] Would scrape ${sanitized} (API integration pending)`);
    return [];
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
        console.warn(`[Scraper:iCal] HTTP ${response.status} for ${sanitized}`);
        return [];
      }

      const content = await response.text();
      const events = parseIcal(content, { now: new Date() });
      console.log(`[Scraper:iCal] Parsed ${events.length} events from ${sanitized}`);
      return events;
    } catch (error: any) {
      console.warn(`[Scraper:iCal] Error: ${error.message}`);
      return [];
    }
  }
}

// ─── Adapter Registry ────────────────────────────────────────────────────────

const adapters: ScraperAdapter[] = [
  new HtmlScraperAdapter(),
  new FacebookScraperAdapter(),
  new InstagramScraperAdapter(),
  new RssScraperAdapter(),
];

export function getAdapterForType(sourceType: string): ScraperAdapter | null {
  return adapters.find((a) => a.canHandle(sourceType)) ?? null;
}

// ─── Scrape Runner ───────────────────────────────────────────────────────────

export async function scrapeSource(source: {
  id: number;
  name: string;
  url: string;
  sourceType: string;
}): Promise<{ eventsFound: number; eventsAdded: number }> {
  const adapter = getAdapterForType(source.sourceType);
  if (!adapter) {
    console.warn(`[Scraper] No adapter for source type: ${source.sourceType}`);
    return { eventsFound: 0, eventsAdded: 0 };
  }

  const startTime = Date.now();
  let eventsFound = 0;
  let eventsAdded = 0;

  try {
    const scrapedEvents = await adapter.scrape(source.url, source.name);
    eventsFound = scrapedEvents.length;

    for (const ev of scrapedEvents) {
      try {
        // Dedup is handled by upsertEvent via canonicalKey (title + start date),
        // so we don't synthesize an externalId here. externalId stays as the
        // source's own identifier when the adapter provides one.
        const insertEvent: InsertEvent = {
          sourceId: source.id,
          externalId: ev.externalId ?? null,
          title: ev.title,
          description: ev.description ?? null,
          danceStyle: (ev.danceStyle ?? null) as InsertEvent["danceStyle"],
          eventType: (ev.eventType ?? null) as InsertEvent["eventType"],
          startAt: new Date(ev.startAt),
          endAt: ev.endAt ? new Date(ev.endAt) : null,
          venueName: ev.venueName ?? null,
          venueAddress: ev.venueAddress ?? null,
          city: ev.city ?? null,
          prefecture: ev.prefecture ?? null,
          latitude: ev.latitude?.toString() ?? null,
          longitude: ev.longitude?.toString() ?? null,
          nearestStation: ev.nearestStation ?? null,
          imageUrl: ev.imageUrl ?? null,
          sourceUrl: ev.sourceUrl ?? source.url,
          price: ev.price ?? null,
          organizer: ev.organizer ?? null,
        };
        await upsertEvent(insertEvent);
        eventsAdded++;
      } catch (err: any) {
        console.warn(`[Scraper] Failed to insert event "${ev.title}":`, err.message);
      }
    }

    await updateSourceScrapedAt(source.id);
    await addScrapeLog({
      sourceId: source.id,
      status: eventsAdded === eventsFound ? "success" : "partial",
      eventsFound,
      eventsAdded,
      durationMs: Date.now() - startTime,
    });
  } catch (error: any) {
    await addScrapeLog({
      sourceId: source.id,
      status: "error",
      eventsFound: 0,
      eventsAdded: 0,
      errorMessage: error.message?.slice(0, 500),
      durationMs: Date.now() - startTime,
    });
  }

  return { eventsFound, eventsAdded };
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let cycleInFlight = false;

const SCRAPE_CONCURRENCY = 4;

export async function runAllScrapers(): Promise<void> {
  // Overlap guard — a slow cycle (many sources × 15s timeout) can run longer
  // than SCRAPER_INTERVAL_MS. Without this, setInterval would fire a second
  // cycle on top of the first and double the load on every source.
  if (cycleInFlight) {
    console.warn("[Scraper] Previous cycle still running, skipping this tick");
    return;
  }
  cycleInFlight = true;
  try {
    console.log("[Scraper] Starting scrape cycle...");
    const sources = await getActiveSources();
    console.log(`[Scraper] Found ${sources.length} active sources`);

    let totalFound = 0;
    let totalAdded = 0;

    // Run sources with bounded concurrency. Sequential scraping made one slow
    // source serialize the whole cycle.
    const queue = [...sources];
    const workers = Array.from({ length: Math.min(SCRAPE_CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const source = queue.shift();
        if (!source) break;
        const result = await scrapeSource(source);
        totalFound += result.eventsFound;
        totalAdded += result.eventsAdded;
      }
    });
    await Promise.all(workers);

    console.log(`[Scraper] Cycle complete: ${totalFound} found, ${totalAdded} added`);

    // Backfill coordinates for events whose source provided an address but no
    // lat/lng (iCal feeds in particular). Cached per-address, so repeat venues
    // are nearly free.
    await geocodeMissingEvents()
      .then(({ scanned, geocoded }) => {
        if (scanned > 0) console.log(`[Geocode] ${geocoded}/${scanned} events geocoded`);
      })
      .catch((err) => console.warn("[Geocode] Backfill failed:", err.message));

    // Bound scrape_logs growth — keep ~30 days of audit history.
    await pruneOldScrapeLogs(30).catch((err) =>
      console.warn("[Scraper] Failed to prune logs:", err.message),
    );
  } finally {
    cycleInFlight = false;
  }
}

export function startScheduler(): void {
  if (schedulerInterval) {
    console.warn("[Scraper] Scheduler already running");
    return;
  }

  console.log(`[Scraper] Scheduler starting (interval: ${SCRAPER_INTERVAL_MS / 1000}s)`);

  setTimeout(() => {
    runAllScrapers().catch((err) =>
      console.error("[Scraper] Initial scrape failed:", err)
    );
  }, SCRAPER_INITIAL_DELAY_MS);

  schedulerInterval = setInterval(() => {
    runAllScrapers().catch((err) =>
      console.error("[Scraper] Scheduled scrape failed:", err)
    );
  }, SCRAPER_INTERVAL_MS);
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scraper] Scheduler stopped");
  }
}
