import { describe, expect, it } from "vitest";
import {
  DANCE_STYLES,
  DANCE_STYLE_OPTIONS,
  DANCE_STYLE_COLORS,
  DANCE_STYLE_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_OPTIONS,
  EVENT_TYPE_LABELS,
  SOURCE_TYPE_OPTIONS,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_ICONS,
  JAPAN_CITIES,
  DATE_RANGE_OPTIONS,
  DEFAULT_MAP_REGION,
  DEFAULT_PREFERENCES,
  DISTANCE_OPTIONS_KM,
  WALK_TIME_OPTIONS_MIN,
  SCRAPER_INTERVAL_MS,
  SCRAPER_INITIAL_DELAY_MS,
  SCRAPER_FETCH_TIMEOUT_MS,
  SCRAPER_USER_AGENT,
  SCRAPER_MAX_HTML_CHARS,
  API_DEFAULT_PAGE_SIZE,
  API_MAX_PAGE_SIZE,
  API_EVENT_LOOKAHEAD_DAYS,
  API_EVENT_LOOKBACK_DAYS,
  STORAGE_KEYS,
  ALLOWED_URL_PROTOCOLS,
  MAX_URL_LENGTH,
  MAX_SOURCE_NAME_LENGTH,
  APP_VERSION,
  APP_REGION,
} from "../shared/constants";

describe("shared/constants", () => {
  describe("DANCE_STYLES", () => {
    it("should include all 15 dance styles", () => {
      expect(DANCE_STYLES.length).toBe(15);
      expect(DANCE_STYLES).toContain("salsa");
      expect(DANCE_STYLES).toContain("bachata");
      expect(DANCE_STYLES).toContain("zouk");
      expect(DANCE_STYLES).toContain("kizomba");
      expect(DANCE_STYLES).toContain("merengue");
      expect(DANCE_STYLES).toContain("cha-cha-cha");
      expect(DANCE_STYLES).toContain("cumbia");
      expect(DANCE_STYLES).toContain("reggaeton");
      expect(DANCE_STYLES).toContain("samba");
      expect(DANCE_STYLES).toContain("tango");
      expect(DANCE_STYLES).toContain("rumba");
      expect(DANCE_STYLES).toContain("mambo");
      expect(DANCE_STYLES).toContain("afro-latin");
      expect(DANCE_STYLES).toContain("mixed");
      expect(DANCE_STYLES).toContain("other");
    });

    it("should have unique values", () => {
      expect(new Set(DANCE_STYLES).size).toBe(DANCE_STYLES.length);
    });
  });

  describe("DANCE_STYLE_OPTIONS", () => {
    it("should include an 'all' option as the first entry", () => {
      expect(DANCE_STYLE_OPTIONS[0]).toEqual({ label: "All", value: "all" });
    });

    it("should include salsa, bachata, zouk, kizomba, tango options", () => {
      const values = DANCE_STYLE_OPTIONS.map((o) => o.value);
      expect(values).toContain("salsa");
      expect(values).toContain("bachata");
      expect(values).toContain("zouk");
      expect(values).toContain("kizomba");
      expect(values).toContain("tango");
    });

    it("should have unique values", () => {
      const values = DANCE_STYLE_OPTIONS.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it("should have one more option than DANCE_STYLES (for 'all')", () => {
      expect(DANCE_STYLE_OPTIONS.length).toBe(DANCE_STYLES.length + 1);
    });
  });

  describe("DANCE_STYLE_COLORS", () => {
    it("should have a color for every dance style", () => {
      DANCE_STYLES.forEach((style) => {
        expect(DANCE_STYLE_COLORS[style]).toBeDefined();
      });
    });

    it("should return valid hex color strings", () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      Object.values(DANCE_STYLE_COLORS).forEach((color) => {
        expect(color).toMatch(hexRegex);
      });
    });
  });

  describe("DANCE_STYLE_LABELS", () => {
    it("should have a label for every dance style", () => {
      DANCE_STYLES.forEach((style) => {
        expect(typeof DANCE_STYLE_LABELS[style]).toBe("string");
        expect(DANCE_STYLE_LABELS[style].length).toBeGreaterThan(0);
      });
    });

    it("should have correct labels for key styles", () => {
      expect(DANCE_STYLE_LABELS["salsa"]).toBe("Salsa");
      expect(DANCE_STYLE_LABELS["bachata"]).toBe("Bachata");
      expect(DANCE_STYLE_LABELS["zouk"]).toBe("Zouk");
      expect(DANCE_STYLE_LABELS["kizomba"]).toBe("Kizomba");
      expect(DANCE_STYLE_LABELS["tango"]).toBe("Tango");
      expect(DANCE_STYLE_LABELS["other"]).toBe("Other");
    });
  });

  describe("EVENT_TYPES", () => {
    it("should include all 8 event types", () => {
      expect(EVENT_TYPES.length).toBe(8);
      expect(EVENT_TYPES).toContain("social");
      expect(EVENT_TYPES).toContain("workshop");
      expect(EVENT_TYPES).toContain("performance");
      expect(EVENT_TYPES).toContain("festival");
      expect(EVENT_TYPES).toContain("class");
      expect(EVENT_TYPES).toContain("congress");
      expect(EVENT_TYPES).toContain("bootcamp");
      expect(EVENT_TYPES).toContain("other");
    });
  });

  describe("EVENT_TYPE_OPTIONS", () => {
    it("should include standard event types", () => {
      const values = EVENT_TYPE_OPTIONS.map((o) => o.value);
      expect(values).toContain("social");
      expect(values).toContain("workshop");
      expect(values).toContain("festival");
      expect(values).toContain("class");
      expect(values).toContain("congress");
      expect(values).toContain("bootcamp");
    });

    it("should have unique values", () => {
      const values = EVENT_TYPE_OPTIONS.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe("EVENT_TYPE_LABELS", () => {
    it("should have labels for all event types including other", () => {
      expect(EVENT_TYPE_LABELS["social"]).toBe("Social Dance");
      expect(EVENT_TYPE_LABELS["other"]).toBe("Other");
    });
  });

  describe("SOURCE_TYPE_OPTIONS", () => {
    it("should include all supported source types", () => {
      expect(SOURCE_TYPE_OPTIONS).toContain("facebook");
      expect(SOURCE_TYPE_OPTIONS).toContain("instagram");
      expect(SOURCE_TYPE_OPTIONS).toContain("rss");
      expect(SOURCE_TYPE_OPTIONS).toContain("html");
      expect(SOURCE_TYPE_OPTIONS).toContain("custom");
    });
  });

  describe("SOURCE_TYPE_LABELS", () => {
    it("should have a human-readable label for every source type", () => {
      SOURCE_TYPE_OPTIONS.forEach((type) => {
        expect(typeof SOURCE_TYPE_LABELS[type]).toBe("string");
        expect(SOURCE_TYPE_LABELS[type].length).toBeGreaterThan(0);
      });
    });
  });

  describe("SOURCE_TYPE_ICONS", () => {
    it("should have an icon for every source type", () => {
      SOURCE_TYPE_OPTIONS.forEach((type) => {
        expect(typeof SOURCE_TYPE_ICONS[type]).toBe("string");
        expect(SOURCE_TYPE_ICONS[type].length).toBeGreaterThan(0);
      });
    });
  });

  describe("JAPAN_CITIES", () => {
    it("should have an empty-value 'All Cities' option first", () => {
      expect(JAPAN_CITIES[0]).toEqual({ label: "All Cities", value: "" });
    });

    it("should include major Japanese cities", () => {
      const values = JAPAN_CITIES.map((c) => c.value);
      expect(values).toContain("Tokyo");
      expect(values).toContain("Osaka");
      expect(values).toContain("Nagoya");
      expect(values).toContain("Fukuoka");
      expect(values).toContain("Kyoto");
      expect(values).toContain("Sapporo");
    });

    it("should have unique values", () => {
      const values = JAPAN_CITIES.map((c) => c.value);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe("DATE_RANGE_OPTIONS", () => {
    it("should include upcoming, week, month, past_month, and all", () => {
      const values = DATE_RANGE_OPTIONS.map((o) => o.value);
      expect(values).toContain("upcoming");
      expect(values).toContain("week");
      expect(values).toContain("month");
      expect(values).toContain("past_month");
      expect(values).toContain("all");
    });
  });

  describe("DEFAULT_MAP_REGION", () => {
    it("should be centered on Tokyo area", () => {
      expect(DEFAULT_MAP_REGION.latitude).toBeCloseTo(35.6762, 2);
      expect(DEFAULT_MAP_REGION.longitude).toBeCloseTo(139.6503, 2);
    });

    it("should have positive delta values", () => {
      expect(DEFAULT_MAP_REGION.latitudeDelta).toBeGreaterThan(0);
      expect(DEFAULT_MAP_REGION.longitudeDelta).toBeGreaterThan(0);
    });
  });

  describe("DEFAULT_PREFERENCES", () => {
    it("should have Tokyo as default city", () => {
      expect(DEFAULT_PREFERENCES.city).toBe("Tokyo");
    });

    it("should have notifications enabled by default", () => {
      expect(DEFAULT_PREFERENCES.notificationsEnabled).toBe(true);
    });

    it("should have a positive max distance", () => {
      expect(DEFAULT_PREFERENCES.maxDistanceKm).toBeGreaterThan(0);
    });

    it("should include all major dance styles in default preferences", () => {
      expect(DEFAULT_PREFERENCES.danceStyles).toContain("salsa");
      expect(DEFAULT_PREFERENCES.danceStyles).toContain("bachata");
      expect(DEFAULT_PREFERENCES.danceStyles).toContain("zouk");
      expect(DEFAULT_PREFERENCES.danceStyles).toContain("kizomba");
      expect(DEFAULT_PREFERENCES.danceStyles).toContain("tango");
    });

    it("should include all major event types in default preferences", () => {
      expect(DEFAULT_PREFERENCES.eventTypes).toContain("social");
      expect(DEFAULT_PREFERENCES.eventTypes).toContain("workshop");
      expect(DEFAULT_PREFERENCES.eventTypes).toContain("festival");
      expect(DEFAULT_PREFERENCES.eventTypes).toContain("class");
    });
  });

  describe("DISTANCE_OPTIONS_KM", () => {
    it("should be sorted in ascending order", () => {
      for (let i = 1; i < DISTANCE_OPTIONS_KM.length; i++) {
        expect(DISTANCE_OPTIONS_KM[i]).toBeGreaterThan(DISTANCE_OPTIONS_KM[i - 1]);
      }
    });

    it("should contain only positive numbers", () => {
      DISTANCE_OPTIONS_KM.forEach((d) => expect(d).toBeGreaterThan(0));
    });
  });

  describe("WALK_TIME_OPTIONS_MIN", () => {
    it("should be sorted in ascending order", () => {
      for (let i = 1; i < WALK_TIME_OPTIONS_MIN.length; i++) {
        expect(WALK_TIME_OPTIONS_MIN[i]).toBeGreaterThan(WALK_TIME_OPTIONS_MIN[i - 1]);
      }
    });
  });

  describe("Scraper configuration", () => {
    it("should have a 1-hour interval", () => {
      expect(SCRAPER_INTERVAL_MS).toBe(3_600_000);
    });

    it("should have a positive initial delay", () => {
      expect(SCRAPER_INITIAL_DELAY_MS).toBeGreaterThan(0);
    });

    it("should have a fetch timeout between 5s and 60s", () => {
      expect(SCRAPER_FETCH_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
      expect(SCRAPER_FETCH_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
    });

    it("should have a user agent string", () => {
      expect(SCRAPER_USER_AGENT.length).toBeGreaterThan(10);
      expect(SCRAPER_USER_AGENT).toContain("SalsaBachata");
    });

    it("should limit HTML chars to a reasonable size", () => {
      expect(SCRAPER_MAX_HTML_CHARS).toBeGreaterThan(1_000);
      expect(SCRAPER_MAX_HTML_CHARS).toBeLessThanOrEqual(100_000);
    });
  });

  describe("API limits", () => {
    it("should have a default page size less than or equal to max", () => {
      expect(API_DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(API_MAX_PAGE_SIZE);
    });

    it("should have a positive lookahead days", () => {
      expect(API_EVENT_LOOKAHEAD_DAYS).toBeGreaterThan(0);
    });

    it("should have a positive lookback days for history", () => {
      expect(API_EVENT_LOOKBACK_DAYS).toBeGreaterThan(0);
      expect(API_EVENT_LOOKBACK_DAYS).toBe(30);
    });
  });

  describe("STORAGE_KEYS", () => {
    it("should have unique key values", () => {
      const values = Object.values(STORAGE_KEYS);
      expect(new Set(values).size).toBe(values.length);
    });

    it("should prefix all keys with @salsa_", () => {
      Object.values(STORAGE_KEYS).forEach((key) => {
        expect(key.startsWith("@salsa_")).toBe(true);
      });
    });

    it("should include FAVORITES key", () => {
      expect(STORAGE_KEYS.FAVORITES).toBeDefined();
    });
  });

  describe("URL validation constants", () => {
    it("should allow only http and https protocols", () => {
      expect(ALLOWED_URL_PROTOCOLS).toContain("https:");
      expect(ALLOWED_URL_PROTOCOLS).toContain("http:");
      expect(ALLOWED_URL_PROTOCOLS.length).toBe(2);
    });

    it("should have a reasonable max URL length", () => {
      expect(MAX_URL_LENGTH).toBe(2048);
    });

    it("should have a reasonable max source name length", () => {
      expect(MAX_SOURCE_NAME_LENGTH).toBe(255);
    });
  });

  describe("App metadata", () => {
    it("should have a valid semver version", () => {
      expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("should have Japan as the region", () => {
      expect(APP_REGION).toBe("Japan");
    });
  });
});
