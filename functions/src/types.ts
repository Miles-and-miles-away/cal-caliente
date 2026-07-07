// Shared scraper types, ported from the old server/scraper.ts.

export interface ScrapedEvent {
  externalId?: string;
  title: string;
  description?: string;
  danceStyle?: string;
  eventType?: string;
  startAt: string;
  endAt?: string;
  /** All-day / VALUE=DATE event (multi-day festivals etc.). */
  isAllDay?: boolean;
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
