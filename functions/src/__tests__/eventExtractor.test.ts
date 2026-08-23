import {
  __testing,
  buildPrompt,
  filterAndNormalizeLlmEvents,
  parseLlmResponse,
} from "../eventExtractor";

const now = new Date("2026-08-01T00:00:00+09:00");

describe("filterAndNormalizeLlmEvents", () => {
  it("drops past events the LLM returned despite the prompt", () => {
    const out = filterAndNormalizeLlmEvents(
      [
        { title: "Past social", startAt: "2026-07-01T19:00:00+09:00" },
        { title: "Upcoming social", startAt: "2026-08-02T19:00:00+09:00" },
      ],
      now,
    );
    expect(out.map((e) => e.title)).toEqual(["Upcoming social"]);
  });

  it("normalizes nulls to undefined so absent fields stay absent in Firestore", () => {
    const [out] = filterAndNormalizeLlmEvents(
      [
        {
          title: "Social",
          startAt: "2026-08-02T19:00:00+09:00",
          venueName: null,
          price: null,
          endAt: null,
        },
      ],
      now,
    );
    expect(out.venueName).toBeUndefined();
    expect(out.price).toBeUndefined();
    expect(out.endAt).toBeUndefined();
  });
});

describe("parseLlmResponse", () => {
  it("parses plain JSON", () => {
    expect(parseLlmResponse('{"events":[]}')).toEqual({ events: [] });
  });

  it("strips markdown code fences", () => {
    expect(parseLlmResponse('```json\n{"events":[]}\n```')).toEqual({ events: [] });
  });
});

describe("llmOutputSchema", () => {
  it("accepts a minimal valid event", () => {
    const res = __testing.llmOutputSchema.safeParse({
      events: [{ title: "X", startAt: "2026-08-02T19:00:00+09:00" }],
    });
    expect(res.success).toBe(true);
  });

  it("rejects an event missing a title", () => {
    const res = __testing.llmOutputSchema.safeParse({
      events: [{ startAt: "2026-08-02T19:00:00+09:00" }],
    });
    expect(res.success).toBe(false);
  });

  it("rejects a non-ISO startAt", () => {
    const res = __testing.llmOutputSchema.safeParse({
      events: [{ title: "X", startAt: "next Saturday" }],
    });
    expect(res.success).toBe(false);
  });
});

describe("buildPrompt", () => {
  it("embeds the source metadata, current date, and page HTML", () => {
    const prompt = buildPrompt({
      html: "<p>salsa night</p>",
      sourceUrl: "https://example.com/events",
      sourceName: "Example Venue",
      now,
    });
    expect(prompt).toContain("https://example.com/events");
    expect(prompt).toContain("Example Venue");
    expect(prompt).toContain(now.toISOString());
    expect(prompt).toContain("<p>salsa night</p>");
  });
});
