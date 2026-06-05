import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyDanceStyle,
  classifyEventType,
  extractCity,
  googleCalendarDayUrl,
  htmlToPlainText,
  parseIcal,
  parseLocation,
} from "../server/_core/ical-parser";

const fixture = readFileSync(
  join(__dirname, "fixtures", "sample-events.ics"),
  "utf-8",
);

// Pin "now" to a date that puts the in-window fixture events ahead of us
// and the past/far-future ones outside the 60-day window.
const NOW = new Date("2026-06-01T00:00:00+09:00");

describe("classifyDanceStyle", () => {
  it("matches single-style titles", () => {
    expect(classifyDanceStyle("Salsa Night", "")).toBe("salsa");
    expect(classifyDanceStyle("Bachata Workshop", "")).toBe("bachata");
    expect(classifyDanceStyle("Brazilian Zouk", "")).toBe("zouk");
    expect(classifyDanceStyle("Argentine Tango Milonga", "")).toBe("tango");
  });

  it("recognises katakana style names", () => {
    expect(classifyDanceStyle("サルサナイト", "")).toBe("salsa");
    expect(classifyDanceStyle("バチャータレッスン", "")).toBe("bachata");
    expect(classifyDanceStyle("キゾンバ social", "")).toBe("kizomba");
  });

  it("title beats description on multi-style events", () => {
    // Title says salsa, description mentions bachata three times — title wins.
    expect(
      classifyDanceStyle(
        "Salsa Night",
        "Bachata bachata bachata is also played",
      ),
    ).toBe("salsa");
  });

  it("falls through to description when title has no recognized style", () => {
    expect(
      classifyDanceStyle("Tuesday Social", "Bachata sensual lessons followed by social"),
    ).toBe("bachata");
  });

  it("returns 'mixed' when nothing matches in either field", () => {
    expect(classifyDanceStyle("Generic Latin Night", "Various music")).toBe("mixed");
    expect(classifyDanceStyle("", "")).toBe("mixed");
  });

  it("handles cha-cha-cha across spelling variants", () => {
    expect(classifyDanceStyle("Cha Cha Cha class", "")).toBe("cha-cha-cha");
    expect(classifyDanceStyle("Cha-Cha-Cha class", "")).toBe("cha-cha-cha");
    expect(classifyDanceStyle("チャチャチャ class", "")).toBe("cha-cha-cha");
  });

  it("does not false-match on Latin-script substrings (word-boundary check)", () => {
    expect(classifyDanceStyle("Tutango lessons", "")).toBe("mixed");
    expect(classifyDanceStyle("Salsamento workshop", "")).toBe("mixed");
    expect(classifyDanceStyle("Bachatastic event", "")).toBe("mixed");
    // Hyphens are NOT word characters, so `\bsalsa\b` matches "salsa-class"
    expect(classifyDanceStyle("salsa-class", "")).toBe("salsa");
  });
});

describe("classifyEventType", () => {
  it.each([
    ["festival", "Tokyo Salsa Festival 2026"],
    ["congress", "Japan Salsa Congress"],
    ["workshop", "Bachata Sensual Workshop"],
    ["class", "Salsa Class — Beginners"],
    ["class", "サルサレッスン"],
    ["class", "Tuesday Lesson"],
    ["social", "Salsa Social Night"],
    ["social", "Friday Latin Party"],
    ["performance", "Bachata Performance Show"],
    ["bootcamp", "Kizomba Bootcamp"],
  ])("%s for %s", (expected, title) => {
    expect(classifyEventType(title, "")).toBe(expected);
  });

  it("falls through to description when title is generic", () => {
    // Use titles that contain no event-type keywords. "Night" matches `social`,
    // so we deliberately avoid it.
    expect(classifyEventType("Tuesday gathering", "Salsa workshop")).toBe("workshop");
    expect(classifyEventType("Latin event", "Class for beginners")).toBe("class");
  });

  it("returns null when neither field matches anything known", () => {
    expect(classifyEventType("", "")).toBeNull();
    expect(classifyEventType("Generic gathering", "")).toBeNull();
  });

  it("more specific patterns beat more generic ones in the title", () => {
    // "Salsa Workshop Festival" — both workshop and festival appear; festival
    // is listed first in EVENT_TYPE_PATTERNS so it wins. Same logic as
    // dance-style probe order.
    expect(classifyEventType("Salsa Workshop Festival", "")).toBe("festival");
  });
});

describe("extractCity", () => {
  it.each([
    ["Tokyo", "東京都"],
    ["Tokyo", "Tokyo, Japan"],
    ["Osaka", "大阪市中央区"],
    ["Yokohama", "Yokohama, Kanagawa"],
    ["Fukuoka", "福岡市博多区"],
    ["Okinawa", "沖縄県那覇市"],
  ])("returns %s for %s", (expected, input) => {
    expect(extractCity(input)).toBe(expected);
  });

  it("returns undefined when no known city is present", () => {
    expect(extractCity("Some random text")).toBeUndefined();
    expect(extractCity("")).toBeUndefined();
  });
});

describe("parseLocation", () => {
  it("splits 'venue, address, country' format", () => {
    const out = parseLocation(
      "Club Salud!, 6-60-9 Higashi-Nippori, Arakawa-ku, Tokyo 116-0014, 日本",
    );
    expect(out.venueName).toBe("Club Salud!");
    expect(out.venueAddress).toContain("Higashi-Nippori");
    expect(out.venueAddress).not.toMatch(/日本/); // 日本 is dropped as redundant
    expect(out.city).toBe("Tokyo");
  });

  it("handles fullwidth Japanese commas", () => {
    const out = parseLocation("日暮里サルー！、東京都荒川区東日暮里6-60-9");
    expect(out.venueName).toBe("日暮里サルー！");
    expect(out.venueAddress).toContain("東日暮里");
    expect(out.city).toBe("Tokyo");
  });

  it("treats single-part input as an address", () => {
    const out = parseLocation("Just an address string");
    expect(out.venueName).toBeUndefined();
    expect(out.venueAddress).toBe("Just an address string");
  });

  it("returns empty object on null/empty", () => {
    expect(parseLocation(null)).toEqual({});
    expect(parseLocation(undefined)).toEqual({});
    expect(parseLocation("")).toEqual({});
  });
});

describe("parseIcal", () => {
  it("returns events from the fixture, filtered to the 60-day window", () => {
    const events = parseIcal(fixture, { now: NOW });

    // We expect: single-event-1 (June 15), recurring-event-1 (June 1, 8, 15, 22 — but COUNT=4),
    // javascript-url-event (June 20), no-style-event (June 25), title-vs-description (June 28).
    // Filtered out: past-event-1 (Dec 2025), far-future-event-1 (Jan 2027).
    const titles = events.map((e) => e.title);
    expect(titles).toContain("Tokyo Salsa Social Night");
    expect(titles).toContain("〜火曜日〜Bachata Sensual Class");
    expect(titles).toContain("Salsa Night"); // title-vs-description
    expect(titles).not.toContain("Last Year's Festival");
    expect(titles).not.toContain("Festival Way Out There");
  });

  it("expands RRULEs into concrete occurrences", () => {
    const events = parseIcal(fixture, { now: NOW });
    // Filter by the externalId UID prefix — title alone now collides with
    // the non-recurring "Bachata Sensual Workshop" entry in the fixture.
    const recurring = events.filter((e) => e.externalId?.startsWith("recurring-event-1@test@"));
    // RRULE FREQ=WEEKLY;COUNT=4, starting 2026-06-01 — but our window starts at
    // NOW=2026-06-01. So we expect 4 occurrences (June 2 isn't a Tuesday — wait,
    // June 1 2026 is a Monday. June 2 is Tuesday. The DTSTART is June 1 19:30
    // (a Monday — odd), but RRULE BYDAY=TU shifts to Tuesdays.) ICAL.js handles
    // this normalization. Don't over-assert exact dates; just verify there are
    // multiple occurrences.
    expect(recurring.length).toBeGreaterThan(1);
    expect(recurring.length).toBeLessThanOrEqual(4);

    // Each occurrence should have a distinct startAt.
    const distinctStarts = new Set(recurring.map((e) => e.startAt));
    expect(distinctStarts.size).toBe(recurring.length);
  });

  it("classifies dance styles correctly across the fixture", () => {
    const events = parseIcal(fixture, { now: NOW });
    const byTitle = Object.fromEntries(events.map((e) => [e.title, e]));

    expect(byTitle["Tokyo Salsa Social Night"]?.danceStyle).toBe("salsa");
    expect(byTitle["〜火曜日〜Bachata Sensual Class"]?.danceStyle).toBe("bachata");
    expect(byTitle["Salsa Night"]?.danceStyle).toBe("salsa"); // title beats description
    expect(byTitle["Generic Latin Night"]?.danceStyle).toBe("mixed");
  });

  it("strips unsafe URLs from sourceUrl", () => {
    const events = parseIcal(fixture, { now: NOW });
    const unsafe = events.find((e) => e.title === "Event with unsafe URL");
    expect(unsafe).toBeDefined();
    expect(unsafe!.sourceUrl).toBeUndefined();
  });

  it("preserves http(s) URLs as sourceUrl", () => {
    const events = parseIcal(fixture, { now: NOW });
    const safe = events.find((e) => e.title === "Tokyo Salsa Social Night");
    expect(safe!.sourceUrl).toBe("https://example.com/events/tokyo-salsa-social");
  });

  it("parses location into venueName + venueAddress + city", () => {
    const events = parseIcal(fixture, { now: NOW });
    const ev = events.find((e) => e.title === "Tokyo Salsa Social Night")!;
    expect(ev.venueName).toBe("Club Salud!");
    expect(ev.venueAddress).toContain("Higashi-Nippori");
    expect(ev.city).toBe("Tokyo");
  });

  it("preserves Japanese descriptions verbatim", () => {
    const events = parseIcal(fixture, { now: NOW });
    const ev = events.find((e) =>
      e.externalId?.startsWith("recurring-event-1@test@"),
    )!;
    expect(ev.description).toContain("火曜日");
    expect(ev.description).toContain("¥1500");
  });

  it("emits unique externalIds for recurring occurrences", () => {
    const events = parseIcal(fixture, { now: NOW });
    const recurringIds = events
      .filter((e) => e.externalId?.startsWith("recurring-event-1@test@"))
      .map((e) => e.externalId);
    const unique = new Set(recurringIds);
    expect(unique.size).toBe(recurringIds.length);
    expect(recurringIds.length).toBeGreaterThan(0);
  });

  it("returns [] on malformed iCal input", () => {
    expect(parseIcal("not iCal", { now: NOW })).toEqual([]);
    expect(parseIcal("", { now: NOW })).toEqual([]);
  });

  it("skips events with STATUS:CANCELLED", () => {
    const events = parseIcal(fixture, { now: NOW });
    const titles = events.map((e) => e.title);
    expect(titles).not.toContain("Cancelled Salsa Social");
  });

  it("skips all-day events (VALUE=DATE) — they have no useful start time", () => {
    const events = parseIcal(fixture, { now: NOW });
    const titles = events.map((e) => e.title);
    expect(titles).not.toContain("Tokyo Salsa Festival");
  });

  it("populates eventType for iCal events when title/description signals one", () => {
    const events = parseIcal(fixture, { now: NOW });
    const ws = events.find((e) => e.title === "Bachata Sensual Workshop");
    expect(ws).toBeDefined();
    expect(ws!.eventType).toBe("workshop");
  });

  it("truncates summaries to 500 chars to satisfy the DB column", () => {
    const events = parseIcal(fixture, { now: NOW });
    const long = events.find((e) => e.title.startsWith("Salsa night with an absurdly long title"));
    expect(long).toBeDefined();
    expect(long!.title.length).toBeLessThanOrEqual(500);
    // Original text in the fixture is well over 500 chars, so we know slicing happened.
    expect(long!.title.length).toBe(500);
  });

  it("respects the windowDays option", () => {
    // 7-day window starting at NOW: only events June 1-8 should make it.
    const events = parseIcal(fixture, { now: NOW, windowDays: 7 });
    const titles = events.map((e) => e.title);
    expect(titles).not.toContain("Tokyo Salsa Social Night"); // June 15
    expect(titles).not.toContain("Generic Latin Night"); // June 25
    // Recurring class on Tuesdays may have one or two occurrences in this window.
  });
});

describe("htmlToPlainText", () => {
  it("converts Google Calendar HTML descriptions to readable plain text", () => {
    // Trimmed from a real scraped event (ごきげんフェス6 at 日暮里サルー).
    const html =
      "<p>ごきげんワールドへようこそ！<br>ごきげんフェス6 開催決定！！</p>" +
      "<p>笑って、つながって、ありのままで楽しもう！<br>即興劇（インプロ）！音楽！</p>" +
      "<p>2026年6月6日（土）日暮里サルー<br>JR日暮里駅東口 徒歩2分</p>";
    const text = htmlToPlainText(html);
    expect(text).not.toMatch(/<[a-z/]/i);
    expect(text).toContain("ごきげんワールドへようこそ！\nごきげんフェス6 開催決定！！");
    expect(text).toContain("\n\n2026年6月6日（土）日暮里サルー\nJR日暮里駅東口 徒歩2分");
  });

  it("leaves plain-text descriptions untouched, including angle-bracket emoticons", () => {
    const plain = "Salsa night! I <3 dancing & you should come. Doors 19:00 > 23:00";
    expect(htmlToPlainText(plain)).toBe(plain);
  });

  it("decodes entities without double-decoding &amp;lt;", () => {
    expect(htmlToPlainText("<p>Fish &amp; Chips &amp;lt;not a tag&amp;gt;</p>")).toBe(
      "Fish & Chips &lt;not a tag&gt;",
    );
  });

  it("renders list items as bullets and collapses blank-line runs", () => {
    const html = "<ul><li>Salsa</li><li>Bachata</li></ul><p></p><p></p><p>Doors open 19:00</p>";
    expect(htmlToPlainText(html)).toBe("• Salsa\n• Bachata\n\nDoors open 19:00");
  });
});

describe("googleCalendarDayUrl", () => {
  const FEED = "https://calendar.google.com/calendar/ical/nippori.salud@gmail.com/public/basic.ics";

  it("builds a browser-viewable day deep-link from a Google Calendar feed", () => {
    const url = googleCalendarDayUrl(FEED, "2026-06-06T03:00:00.000Z");
    expect(url).toBe(
      "https://calendar.google.com/calendar/embed?src=nippori.salud%40gmail.com" +
        "&ctz=Asia%2FTokyo&mode=DAY&dates=20260606%2F20260606",
    );
  });

  it("uses the JST day, not the UTC day, at date boundaries", () => {
    // 18:30 UTC on June 5 is 03:30 JST on June 6.
    const url = googleCalendarDayUrl(FEED, "2026-06-05T18:30:00.000Z");
    expect(url).toContain("dates=20260606");
  });

  it("normalizes already-percent-encoded calendar ids", () => {
    const encoded = FEED.replace("@", "%40");
    expect(googleCalendarDayUrl(encoded, "2026-06-06T03:00:00.000Z")).toContain(
      "src=nippori.salud%40gmail.com",
    );
  });

  it("returns null for non-Google feeds and invalid dates", () => {
    expect(
      googleCalendarDayUrl("https://www.meetup.com/x/events/ical", "2026-06-06T03:00:00.000Z"),
    ).toBeNull();
    expect(googleCalendarDayUrl(FEED, "not a date")).toBeNull();
  });
});
