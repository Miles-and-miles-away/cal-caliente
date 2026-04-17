# Event Scraping Engine

**Last Updated:** 2026-04-17

---

## Overview

The scraping engine is the core data pipeline that automatically discovers dance events from registered sources. It uses an **adapter pattern** where each source type (HTML website, Facebook page, Instagram account, RSS feed) has a dedicated adapter that knows how to fetch and parse events from that type of source.

The engine runs on an hourly schedule via a `setInterval`-based scheduler that starts when the server boots.

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Scheduler   │────▶│  runAllScrapers() │────▶│  scrapeSource()  │
│  (hourly)    │     │  (fetch sources)  │     │  (per source)    │
└─────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │ getAdapterForType │
                                              └────────┬─────────┘
                                                       │
                    ┌──────────────────────────────────┼──────────────────┐
                    │                │                  │                  │
             ┌──────▼──────┐  ┌─────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
             │ HTML Adapter │  │ FB Adapter  │  │ IG Adapter   │  │ RSS Adapter  │
             │ (LLM-ready) │  │ (Graph API) │  │ (Graph API)  │  │ (XML/iCal)   │
             └──────┬──────┘  └─────┬──────┘  └───────┬──────┘  └───────┬──────┘
                    │                │                  │                  │
                    └────────────────┴──────────────────┴──────────────────┘
                                              │
                                     ┌────────▼─────────┐
                                     │  upsertEvent()   │
                                     │  addScrapeLog()  │
                                     └──────────────────┘
```

---

## Adapter Interface

Every scraper adapter implements the `ScraperAdapter` interface:

```typescript
interface ScraperAdapter {
  readonly type: string;
  canHandle(sourceType: string): boolean;
  scrape(url: string, sourceName: string): Promise<ScrapedEvent[]>;
}
```

The `canHandle` method determines whether the adapter can process a given source type. The `scrape` method performs the actual fetching and parsing, returning an array of `ScrapedEvent` objects.

---

## Adapter Status

| Adapter | Source Type | Status | Requirements |
|---------|-----------|--------|--------------|
| `HtmlScraperAdapter` | `html`, `custom` | Stub (fetches HTML, LLM parsing pending) | Server LLM integration |
| `FacebookScraperAdapter` | `facebook` | Stub (checks for API token) | `FACEBOOK_GRAPH_API_TOKEN` env var |
| `InstagramScraperAdapter` | `instagram` | Stub (checks for API token) | `INSTAGRAM_GRAPH_API_TOKEN` env var |
| `RssScraperAdapter` | `rss` | Stub (fetches content, parser pending) | RSS/iCal parser library |

All adapters currently fetch content from the source URL but do not yet parse events. The HTML adapter is designed to send truncated HTML to the server's built-in LLM for intelligent event extraction. The social media adapters will use their respective Graph APIs when tokens are provided.

---

## Scheduler Configuration

The scheduler is configured via constants in `shared/constants.ts`:

| Constant | Default Value | Description |
|----------|---------------|-------------|
| `SCRAPER_INTERVAL_MS` | `3,600,000` (1 hour) | Time between scrape cycles |
| `SCRAPER_INITIAL_DELAY_MS` | `10,000` (10 seconds) | Delay before first scrape after server start |
| `SCRAPER_FETCH_TIMEOUT_MS` | `15,000` (15 seconds) | HTTP request timeout per source |
| `SCRAPER_MAX_HTML_CHARS` | `30,000` | Max HTML characters sent to LLM |
| `SCRAPER_USER_AGENT` | `"SalsaBachataJapan/1.0 ..."` | User-Agent header for HTTP requests |

---

## Scrape Logging

Every scrape attempt is logged in the `scrape_logs` table:

| Field | Description |
|-------|-------------|
| `sourceId` | Which source was scraped |
| `status` | `success`, `partial`, or `error` |
| `eventsFound` | Number of events extracted |
| `eventsAdded` | Number of events successfully inserted/updated |
| `errorMessage` | Error details (truncated to 500 chars) |
| `durationMs` | Total scrape duration in milliseconds |
| `createdAt` | Timestamp of the scrape attempt |

---

## Event Deduplication

Events are deduplicated using the combination of `sourceId` and `externalId`. When a scraped event matches an existing record on these two fields, the existing record is updated rather than creating a duplicate. This allows the scraper to safely re-process sources without creating duplicate events.

---

## Adding a New Adapter

To add support for a new source type:

1. Create a new class implementing `ScraperAdapter` in `server/scraper.ts`.
2. Implement `canHandle()` to match the new source type string.
3. Implement `scrape()` to fetch and parse events from the source.
4. Add an instance of the new adapter to the `adapters` array.
5. Add the new source type to the `SOURCE_TYPE_OPTIONS` constant in `shared/constants.ts`.
6. Update the Zod enum in `server/routers.ts` to accept the new type.
7. Update this documentation.

---

## Enabling Live Scraping (Option B)

To transition from demo data to live event scraping:

1. **Facebook:** Create a Facebook Developer App, generate a Page Access Token, and set `FACEBOOK_GRAPH_API_TOKEN` in the environment.
2. **Instagram:** Set up an Instagram Business Account, connect it to a Facebook App, and set `INSTAGRAM_GRAPH_API_TOKEN`.
3. **HTML/LLM:** The server's built-in LLM is already available. Uncomment the LLM call in `HtmlScraperAdapter.scrape()` and implement the prompt for event extraction.
4. **RSS:** Install an RSS parser library (e.g., `rss-parser`) and implement the XML parsing in `RssScraperAdapter.scrape()`.
