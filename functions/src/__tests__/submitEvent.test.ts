import { HttpsError } from "firebase-functions/v2/https";
import { validateSubmitEventInput } from "../submitEvent";
import { validateRegisterSourceInput } from "../registerSource";

const valid = {
  title: "Tokyo Salsa Night",
  startAt: "2026-08-01T19:00:00+09:00",
};

function expectRejects(data: unknown, pathFragment?: string) {
  try {
    validateSubmitEventInput(data);
    fail("expected HttpsError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpsError);
    expect((err as HttpsError).code).toBe("invalid-argument");
    if (pathFragment) {
      expect((err as HttpsError).message).toContain(pathFragment);
    }
  }
}

describe("validateSubmitEventInput", () => {
  it("accepts a minimal valid submission and trims the title", () => {
    const out = validateSubmitEventInput({ ...valid, title: "  Tokyo Salsa Night  " });
    expect(out.title).toBe("Tokyo Salsa Night");
    expect(out.startAt).toBe(valid.startAt);
  });

  it("accepts all optional fields with valid values", () => {
    const out = validateSubmitEventInput({
      ...valid,
      endAt: "2026-08-01T22:00:00+09:00",
      description: "A fun night",
      danceStyle: "salsa",
      eventType: "social",
      venueName: "Club Salud",
      venueAddress: "1-2-3 Shibuya",
      city: "Tokyo",
      prefecture: "Tokyo",
      nearestStation: "Shibuya",
      price: "¥2000",
      organizer: "Salud crew",
      sourceUrl: "https://example.com/events/1",
    });
    expect(out.city).toBe("Tokyo");
    expect(out.danceStyle).toBe("salsa");
  });

  it("rejects a missing title", () => {
    expectRejects({ startAt: valid.startAt }, "title");
  });

  it("rejects a whitespace-only title", () => {
    expectRejects({ ...valid, title: "   " }, "title");
  });

  it("rejects a title longer than 500 chars", () => {
    expectRejects({ ...valid, title: "x".repeat(501) }, "title");
  });

  it("rejects a non-ISO startAt", () => {
    expectRejects({ ...valid, startAt: "next saturday" }, "startAt");
  });

  it("rejects a missing startAt", () => {
    expectRejects({ title: valid.title }, "startAt");
  });

  it("rejects an invalid endAt", () => {
    expectRejects({ ...valid, endAt: "not-a-date" }, "endAt");
  });

  it("rejects a description over 5000 chars", () => {
    expectRejects({ ...valid, description: "x".repeat(5001) }, "description");
  });

  it("rejects a danceStyle outside the enum", () => {
    expectRejects({ ...valid, danceStyle: "breakdance" }, "danceStyle");
  });

  it("rejects an eventType outside the enum", () => {
    expectRejects({ ...valid, eventType: "rave" }, "eventType");
  });

  it("rejects a city not in the 11 Japan cities", () => {
    expectRejects({ ...valid, city: "Paris" }, "city");
  });

  it("rejects a non-http(s) sourceUrl", () => {
    expectRejects({ ...valid, sourceUrl: "ftp://example.com/feed" }, "sourceUrl");
    expectRejects({ ...valid, sourceUrl: "javascript:alert(1)" }, "sourceUrl");
  });

  it("rejects a sourceUrl over 2048 chars", () => {
    expectRejects(
      { ...valid, sourceUrl: `https://example.com/${"x".repeat(2048)}` },
      "sourceUrl",
    );
  });

  it("rejects unknown keys (strict schema)", () => {
    expectRejects({ ...valid, isVerified: true });
  });
});

describe("validateRegisterSourceInput", () => {
  it("accepts a valid source and trims the name", () => {
    const out = validateRegisterSourceInput({
      name: "  Salsa Tokyo Calendar ",
      url: "https://calendar.google.com/calendar/ical/abc/public/basic.ics",
      sourceType: "rss",
    });
    expect(out.name).toBe("Salsa Tokyo Calendar");
    expect(out.sourceType).toBe("rss");
  });

  it("rejects an empty name", () => {
    expect(() =>
      validateRegisterSourceInput({ name: " ", url: "https://example.com" }),
    ).toThrow(HttpsError);
  });

  it("rejects a name over 255 chars", () => {
    expect(() =>
      validateRegisterSourceInput({
        name: "x".repeat(256),
        url: "https://example.com",
      }),
    ).toThrow(HttpsError);
  });

  it("rejects a non-http(s) url", () => {
    expect(() =>
      validateRegisterSourceInput({ name: "Bad", url: "internal://user-submissions" }),
    ).toThrow(HttpsError);
  });

  it("rejects a url over 768 chars", () => {
    expect(() =>
      validateRegisterSourceInput({
        name: "Long",
        url: `https://example.com/${"x".repeat(768)}`,
      }),
    ).toThrow(HttpsError);
  });

  it("rejects an invalid sourceType", () => {
    expect(() =>
      validateRegisterSourceInput({
        name: "Site",
        url: "https://example.com",
        sourceType: "carrier-pigeon",
      }),
    ).toThrow(HttpsError);
  });
});
