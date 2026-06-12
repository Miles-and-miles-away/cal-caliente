import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock everything scrapeSource/runAllScrapers persist through, so the runner's
// orchestration (counting, statuses, guards) is exercised without a db.
const mockGetActiveSources = vi.fn();
const mockAddScrapeLog = vi.fn();
const mockPruneOldScrapeLogs = vi.fn();
const mockUpdateSourceScrapedAt = vi.fn();
const mockUpsertEvent = vi.fn();
const mockGeocodeMissingEvents = vi.fn();

vi.mock("../server/db", () => ({
  getActiveSources: mockGetActiveSources,
  addScrapeLog: mockAddScrapeLog,
  pruneOldScrapeLogs: mockPruneOldScrapeLogs,
  updateSourceScrapedAt: mockUpdateSourceScrapedAt,
  upsertEvent: mockUpsertEvent,
}));

vi.mock("../server/geocode", () => ({
  geocodeMissingEvents: mockGeocodeMissingEvents,
}));

const { getAdapterForType, runAllScrapers, scrapeSource, startScheduler, stopScheduler } =
  await import("../server/scraper");

const htmlSource = { id: 1, name: "Test Source", url: "https://example.com/events", sourceType: "html" };

// Three minimal scraped events the adapter "found".
const scraped = ["A", "B", "C"].map((t) => ({
  title: `Event ${t}`,
  startAt: new Date("2026-07-10T10:00:00Z"),
}));

function spyOnHtmlAdapter() {
  const adapter = getAdapterForType("html")!;
  return vi.spyOn(adapter, "scrape");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAddScrapeLog.mockResolvedValue(undefined);
  mockUpdateSourceScrapedAt.mockResolvedValue(undefined);
  mockPruneOldScrapeLogs.mockResolvedValue(undefined);
  mockGeocodeMissingEvents.mockResolvedValue({ scanned: 0, geocoded: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scrapeSource", () => {
  it("counts inserted vs merged separately and logs success on a clean run", async () => {
    spyOnHtmlAdapter().mockResolvedValue(scraped as any);
    mockUpsertEvent
      .mockResolvedValueOnce("inserted")
      .mockResolvedValueOnce("merged")
      .mockResolvedValueOnce("merged");

    const result = await scrapeSource(htmlSource);

    expect(result).toEqual({ eventsFound: 3, eventsAdded: 1 });
    expect(mockUpdateSourceScrapedAt).toHaveBeenCalledWith(1);
    // A run where everything was a known duplicate is still a success.
    expect(mockAddScrapeLog).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 1, status: "success", eventsFound: 3, eventsAdded: 1 }),
    );
  });

  it("keeps processing after one event fails to persist, and logs partial", async () => {
    spyOnHtmlAdapter().mockResolvedValue(scraped as any);
    mockUpsertEvent
      .mockResolvedValueOnce("inserted")
      .mockRejectedValueOnce(new Error("deadlock"))
      .mockResolvedValueOnce("inserted");

    const result = await scrapeSource(htmlSource);

    // The middle failure must not abort the loop.
    expect(mockUpsertEvent).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ eventsFound: 3, eventsAdded: 2 });
    expect(mockAddScrapeLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "partial", eventsAdded: 2 }),
    );
  });

  it("logs an error status (with message) when the adapter itself blows up", async () => {
    spyOnHtmlAdapter().mockRejectedValue(new Error("listing page 503"));

    const result = await scrapeSource(htmlSource);

    expect(result).toEqual({ eventsFound: 0, eventsAdded: 0 });
    expect(mockUpdateSourceScrapedAt).not.toHaveBeenCalled();
    expect(mockAddScrapeLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", errorMessage: "listing page 503" }),
    );
  });

  it("returns zeros for an unknown source type without logging a scrape", async () => {
    const result = await scrapeSource({ ...htmlSource, sourceType: "carrier-pigeon" });
    expect(result).toEqual({ eventsFound: 0, eventsAdded: 0 });
    expect(mockAddScrapeLog).not.toHaveBeenCalled();
  });
});

describe("runAllScrapers", () => {
  it("scrapes active sources, then geocodes and prunes logs", async () => {
    spyOnHtmlAdapter().mockResolvedValue([]);
    mockGetActiveSources.mockResolvedValue([htmlSource, { ...htmlSource, id: 2 }]);

    await runAllScrapers();

    expect(mockAddScrapeLog).toHaveBeenCalledTimes(2);
    expect(mockGeocodeMissingEvents).toHaveBeenCalledTimes(1);
    expect(mockPruneOldScrapeLogs).toHaveBeenCalledWith(30);
  });

  it("skips a tick while the previous cycle is still in flight", async () => {
    let releaseSources!: (v: any[]) => void;
    mockGetActiveSources.mockReturnValue(new Promise((r) => (releaseSources = r)));

    const first = runAllScrapers();
    await runAllScrapers(); // overlapping tick — must bail immediately
    expect(mockGetActiveSources).toHaveBeenCalledTimes(1);

    releaseSources([]);
    await first;

    // Guard resets after the cycle, so the next tick runs normally.
    mockGetActiveSources.mockResolvedValue([]);
    await runAllScrapers();
    expect(mockGetActiveSources).toHaveBeenCalledTimes(2);
  });

  it("resets the overlap guard even when the cycle throws", async () => {
    mockGetActiveSources.mockRejectedValueOnce(new Error("db gone"));
    await expect(runAllScrapers()).rejects.toThrow("db gone");

    mockGetActiveSources.mockResolvedValue([]);
    await expect(runAllScrapers()).resolves.toBeUndefined();
  });

  it("finishes the cycle even when geocoding fails", async () => {
    mockGetActiveSources.mockResolvedValue([]);
    mockGeocodeMissingEvents.mockRejectedValue(new Error("GSI down"));

    await expect(runAllScrapers()).resolves.toBeUndefined();
    expect(mockPruneOldScrapeLogs).toHaveBeenCalled();
  });
});

describe("scheduler start/stop guards", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetActiveSources.mockResolvedValue([]);
  });

  afterEach(() => {
    stopScheduler();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("does not double-schedule on a second start()", () => {
    startScheduler();
    const after1 = vi.getTimerCount(); // initial-delay timeout + hourly interval
    startScheduler();
    expect(vi.getTimerCount()).toBe(after1);
  });

  it("stop() clears the interval and a later start() re-arms it", () => {
    startScheduler();
    const armed = vi.getTimerCount();
    stopScheduler();
    expect(vi.getTimerCount()).toBe(armed - 1); // the initial-delay timeout remains

    startScheduler(); // must not be blocked by a stale handle
    expect(vi.getTimerCount()).toBe(armed + 1);
  });
});
