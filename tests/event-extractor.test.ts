import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the LLM module before importing the extractor so the extractor binds
// to the mock. The extractor only depends on `invokeLLM`.
const invokeLLM = vi.fn();
vi.mock("../server/_core/llm", () => ({ invokeLLM }));

const { extractEventsFromHtml } = await import("../server/_core/event-extractor");

const NOW = new Date("2026-05-03T12:00:00+09:00");

function llmReturnsContent(content: string) {
  invokeLLM.mockResolvedValue({
    id: "test",
    created: 0,
    model: "test",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("extractEventsFromHtml", () => {
  it("returns parsed events when the LLM response validates", async () => {
    llmReturnsContent(
      JSON.stringify({
        events: [
          {
            title: "Latin Bar Salud Nippori",
            startAt: "2026-05-10T19:00:00+09:00",
            danceStyle: "salsa",
            eventType: "social",
            venueName: "Club Salud!",
            city: "Tokyo",
            prefecture: "Tokyo",
            nearestStation: "Nippori",
            price: "¥1,500-2,000",
            organizer: "Salud Nippori",
            description: null,
            sourceUrl: "https://example.com/event/123",
            externalId: "salud-nippori",
          },
        ],
      }),
    );

    const events = await extractEventsFromHtml({
      html: "<html>...</html>",
      sourceUrl: "https://example.com",
      sourceName: "Test",
      now: NOW,
    });

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Latin Bar Salud Nippori");
    expect(events[0].danceStyle).toBe("salsa");
    expect(events[0].city).toBe("Tokyo");
  });

  it("filters out events that have already started — backstop against LLM ignoring its filter", async () => {
    llmReturnsContent(
      JSON.stringify({
        events: [
          { title: "Past event", startAt: "2025-12-01T19:00:00+09:00" },
          { title: "Future event", startAt: "2026-06-15T19:00:00+09:00" },
        ],
      }),
    );

    const events = await extractEventsFromHtml({
      html: "<html/>",
      sourceUrl: "https://example.com",
      sourceName: "Test",
      now: NOW,
    });

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Future event");
  });

  it("returns [] when LLM returns malformed JSON", async () => {
    llmReturnsContent("not even json {");
    const events = await extractEventsFromHtml({
      html: "<html/>",
      sourceUrl: "https://example.com",
      sourceName: "Test",
      now: NOW,
    });
    expect(events).toEqual([]);
  });

  it("strips fenced code blocks if the LLM wraps the JSON", async () => {
    llmReturnsContent(
      "```json\n" +
        JSON.stringify({
          events: [{ title: "Wrapped", startAt: "2026-06-01T19:00:00+09:00" }],
        }) +
        "\n```",
    );
    const events = await extractEventsFromHtml({
      html: "<html/>",
      sourceUrl: "https://example.com",
      sourceName: "Test",
      now: NOW,
    });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Wrapped");
  });

  it("rejects events that fail Zod validation (e.g. invalid danceStyle enum)", async () => {
    llmReturnsContent(
      JSON.stringify({
        events: [
          {
            title: "Hallucinated style",
            startAt: "2026-06-01T19:00:00+09:00",
            danceStyle: "twerking", // not in enum
          },
        ],
      }),
    );
    const events = await extractEventsFromHtml({
      html: "<html/>",
      sourceUrl: "https://example.com",
      sourceName: "Test",
      now: NOW,
    });
    // Whole batch is rejected on validation failure. We could be more lenient
    // (per-event filter) but for now we drop the lot and rely on the next
    // scrape cycle to re-attempt — better than half-trusting LLM output.
    expect(events).toEqual([]);
  });

  it("returns [] when LLM returns empty events array (no events on page)", async () => {
    llmReturnsContent(JSON.stringify({ events: [] }));
    const events = await extractEventsFromHtml({
      html: "<html/>",
      sourceUrl: "https://example.com",
      sourceName: "Test",
      now: NOW,
    });
    expect(events).toEqual([]);
  });

  it("rejects events with unparseable startAt", async () => {
    llmReturnsContent(
      JSON.stringify({
        events: [{ title: "Bad date", startAt: "next saturday" }],
      }),
    );
    const events = await extractEventsFromHtml({
      html: "<html/>",
      sourceUrl: "https://example.com",
      sourceName: "Test",
      now: NOW,
    });
    expect(events).toEqual([]);
  });

  it("calls invokeLLM with the source URL and current date in the prompt", async () => {
    llmReturnsContent(JSON.stringify({ events: [] }));
    await extractEventsFromHtml({
      html: "<html/>",
      sourceUrl: "https://example.com/japan",
      sourceName: "TestSource",
      now: NOW,
    });

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    const call = invokeLLM.mock.calls[0][0];
    const userMessage = call.messages.find((m: any) => m.role === "user");
    expect(userMessage.content).toContain("https://example.com/japan");
    expect(userMessage.content).toContain("TestSource");
    expect(userMessage.content).toContain(NOW.toISOString());
  });
});
