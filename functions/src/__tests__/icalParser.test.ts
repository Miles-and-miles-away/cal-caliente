import {
  classifyDanceStyle,
  classifyEventType,
  googleCalendarDayUrl,
  parseIcal,
  parseLocation,
} from "../icalParser";

// Fixed "now" so RRULE expansion is deterministic. Window = 60 days:
// 2026-08-01T00:00Z .. 2026-09-30T00:00Z.
const NOW = new Date("2026-08-01T00:00:00Z");

const FIXTURE = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Test//Test//EN",
  "BEGIN:VEVENT",
  "UID:single-1",
  "DTSTART:20260805T100000Z",
  "DTEND:20260805T130000Z",
  "SUMMARY:Salsa Night Tokyo",
  "DESCRIPTION:Weekly salsa party at Salud",
  "LOCATION:Club Salud, 1-2-3 Shibuya, Tokyo, Japan",
  "URL:https://example.com/events/salsa-night",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:rec-1",
  "DTSTART:20260803T110000Z",
  "DTEND:20260803T130000Z",
  "RRULE:FREQ=WEEKLY;COUNT=20",
  "SUMMARY:Bachata Class",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:cancelled-1",
  "DTSTART:20260810T100000Z",
  "SUMMARY:Zouk Party",
  "STATUS:CANCELLED",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:past-1",
  "DTSTART:20260701T100000Z",
  "SUMMARY:Old Kizomba Social",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:allday-1",
  "DTSTART;VALUE=DATE:20260822",
  "DTEND;VALUE=DATE:20260824",
  "SUMMARY:Japan Salsa Festival",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcal", () => {
  const events = parseIcal(FIXTURE, { now: NOW });

  it("drops cancelled and out-of-window events", () => {
    const titles = events.map((e) => e.title);
    expect(titles).not.toContain("Zouk Party");
    expect(titles).not.toContain("Old Kizomba Social");
  });

  it("parses a single event with location, style, and type", () => {
    const single = events.find((e) => e.externalId === "single-1");
    expect(single).toBeDefined();
    expect(single!.title).toBe("Salsa Night Tokyo");
    expect(single!.startAt).toBe("2026-08-05T10:00:00.000Z");
    expect(single!.endAt).toBe("2026-08-05T13:00:00.000Z");
    expect(single!.danceStyle).toBe("salsa");
    expect(single!.eventType).toBe("social");
    expect(single!.venueName).toBe("Club Salud");
    expect(single!.venueAddress).toBe("1-2-3 Shibuya, Tokyo"); // "Japan" stripped
    expect(single!.city).toBe("Tokyo");
    expect(single!.sourceUrl).toBe("https://example.com/events/salsa-night");
  });

  it("expands an RRULE into concrete occurrences inside the 60-day window", () => {
    const occurrences = events.filter((e) => e.title === "Bachata Class");
    // Weekly from 2026-08-03, window closes 2026-09-30:
    // Aug 3, 10, 17, 24, 31, Sep 7, 14, 21, 28 = 9 occurrences.
    expect(occurrences).toHaveLength(9);
    expect(occurrences[0].startAt).toBe("2026-08-03T11:00:00.000Z");
    // DTEND-derived 2h duration carried onto every occurrence.
    expect(occurrences[0].endAt).toBe("2026-08-03T13:00:00.000Z");
    expect(occurrences[8].startAt).toBe("2026-09-28T11:00:00.000Z");
    // Occurrence-scoped externalIds stay unique.
    expect(occurrences[0].externalId).toBe("rec-1@2026-08-03T11:00:00.000Z");
    expect(new Set(occurrences.map((o) => o.externalId)).size).toBe(9);
    expect(occurrences[0].danceStyle).toBe("bachata");
    expect(occurrences[0].eventType).toBe("class");
  });

  it("anchors all-day events to JST midnight and flags isAllDay", () => {
    const allday = events.find((e) => e.externalId === "allday-1");
    expect(allday).toBeDefined();
    expect(allday!.isAllDay).toBe(true);
    expect(allday!.startAt).toBe("2026-08-22T00:00:00+09:00");
    // DTEND on VALUE=DATE is exclusive; kept as the boundary.
    expect(allday!.endAt).toBe("2026-08-24T00:00:00+09:00");
    expect(allday!.eventType).toBe("festival");
  });

  it("returns [] for garbage input", () => {
    expect(parseIcal("not an ical feed", { now: NOW })).toEqual([]);
  });
});

describe("classifiers", () => {
  it("classifies title before description", () => {
    expect(classifyDanceStyle("Salsa Night w/ bachata after 11", "")).toBe("salsa");
    expect(classifyDanceStyle("Dance party", "Great bachata music")).toBe("bachata");
    expect(classifyDanceStyle("サルサナイト", "")).toBe("salsa");
    expect(classifyDanceStyle("Random meetup", "")).toBe("mixed");
  });

  it("does not substring-match Latin style names", () => {
    expect(classifyDanceStyle("Tutango showcase", "")).toBe("mixed");
  });

  it("classifies event types, most specific first", () => {
    expect(classifyEventType("Salsa Workshop Festival", "")).toBe("festival");
    expect(classifyEventType("Beginner lesson", "")).toBe("class");
    expect(classifyEventType("Something else", "")).toBeNull();
  });
});

describe("parseLocation", () => {
  it("splits venue / address and strips Japan", () => {
    expect(parseLocation("Club Salud, 1-2-3 Shibuya, Tokyo, Japan")).toEqual({
      venueName: "Club Salud",
      venueAddress: "1-2-3 Shibuya, Tokyo",
      city: "Tokyo",
    });
  });

  it("treats a single segment as an address", () => {
    expect(parseLocation("大阪市北区")).toEqual({
      venueAddress: "大阪市北区",
      city: "Osaka",
    });
  });

  it("handles empty input", () => {
    expect(parseLocation(null)).toEqual({});
    expect(parseLocation("")).toEqual({});
  });
});

describe("googleCalendarDayUrl", () => {
  it("builds a JST day deep-link from a Google Calendar feed URL", () => {
    const url = googleCalendarDayUrl(
      "https://calendar.google.com/calendar/ical/abc%40group.calendar.google.com/public/basic.ics",
      "2026-08-05T19:00:00+09:00",
    );
    expect(url).toBe(
      "https://calendar.google.com/calendar/embed?src=abc%40group.calendar.google.com" +
        "&ctz=Asia%2FTokyo&mode=DAY&dates=20260805%2F20260805",
    );
  });

  it("returns null for non-Google-Calendar feeds", () => {
    expect(
      googleCalendarDayUrl("https://example.com/feed.ics", "2026-08-05T19:00:00+09:00"),
    ).toBeNull();
  });
});
