import { describe, expect, it } from "vitest";
import {
  isValidScraperUrl,
  sanitizeUrl,
  getAdapterForType,
  HtmlScraperAdapter,
  FacebookScraperAdapter,
  InstagramScraperAdapter,
  RssScraperAdapter,
} from "../server/scraper";

describe("server/scraper", () => {
  describe("isValidScraperUrl", () => {
    it("should accept valid https URLs", () => {
      expect(isValidScraperUrl("https://example.com")).toBe(true);
      expect(isValidScraperUrl("https://facebook.com/tokyosalsa")).toBe(true);
      expect(isValidScraperUrl("https://www.dance-studio.jp/events")).toBe(true);
    });

    it("should accept valid http URLs", () => {
      expect(isValidScraperUrl("http://example.com")).toBe(true);
    });

    it("should reject javascript: protocol", () => {
      expect(isValidScraperUrl("javascript:alert(1)")).toBe(false);
    });

    it("should reject data: protocol", () => {
      expect(isValidScraperUrl("data:text/html,<h1>test</h1>")).toBe(false);
    });

    it("should reject file: protocol", () => {
      expect(isValidScraperUrl("file:///etc/passwd")).toBe(false);
    });

    it("should reject ftp: protocol", () => {
      expect(isValidScraperUrl("ftp://example.com/file")).toBe(false);
    });

    it("should reject empty strings", () => {
      expect(isValidScraperUrl("")).toBe(false);
    });

    it("should reject non-string input", () => {
      expect(isValidScraperUrl(null as any)).toBe(false);
      expect(isValidScraperUrl(undefined as any)).toBe(false);
      expect(isValidScraperUrl(123 as any)).toBe(false);
    });

    it("should reject URLs exceeding max length", () => {
      const longUrl = "https://example.com/" + "a".repeat(2100);
      expect(isValidScraperUrl(longUrl)).toBe(false);
    });

    it("should reject malformed URLs", () => {
      expect(isValidScraperUrl("not-a-url")).toBe(false);
      expect(isValidScraperUrl("://missing-protocol")).toBe(false);
    });
  });

  describe("sanitizeUrl", () => {
    it("should return the URL without hash fragments", () => {
      const result = sanitizeUrl("https://example.com/page#section");
      expect(result).toBe("https://example.com/page");
    });

    it("should preserve query parameters", () => {
      const result = sanitizeUrl("https://example.com/page?id=123");
      expect(result).toContain("?id=123");
    });

    it("should return null for invalid URLs", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
      expect(sanitizeUrl("")).toBeNull();
      expect(sanitizeUrl("not-a-url")).toBeNull();
    });

    it("should return a valid URL string for valid input", () => {
      const result = sanitizeUrl("https://example.com");
      expect(result).toBeTruthy();
      expect(result!.startsWith("https://")).toBe(true);
    });
  });

  describe("getAdapterForType", () => {
    it("should return HtmlScraperAdapter for 'html' type", () => {
      const adapter = getAdapterForType("html");
      expect(adapter).not.toBeNull();
      expect(adapter!.type).toBe("html");
    });

    it("should return HtmlScraperAdapter for 'custom' type", () => {
      const adapter = getAdapterForType("custom");
      expect(adapter).not.toBeNull();
      expect(adapter!.type).toBe("html");
    });

    it("should return FacebookScraperAdapter for 'facebook' type", () => {
      const adapter = getAdapterForType("facebook");
      expect(adapter).not.toBeNull();
      expect(adapter!.type).toBe("facebook");
    });

    it("should return InstagramScraperAdapter for 'instagram' type", () => {
      const adapter = getAdapterForType("instagram");
      expect(adapter).not.toBeNull();
      expect(adapter!.type).toBe("instagram");
    });

    it("should return RssScraperAdapter for 'rss' type", () => {
      const adapter = getAdapterForType("rss");
      expect(adapter).not.toBeNull();
      expect(adapter!.type).toBe("rss");
    });

    it("should return null for unknown source types", () => {
      expect(getAdapterForType("unknown")).toBeNull();
      expect(getAdapterForType("")).toBeNull();
      expect(getAdapterForType("twitter")).toBeNull();
    });
  });

  describe("HtmlScraperAdapter", () => {
    const adapter = new HtmlScraperAdapter();

    it("should handle 'html' and 'custom' types", () => {
      expect(adapter.canHandle("html")).toBe(true);
      expect(adapter.canHandle("custom")).toBe(true);
      expect(adapter.canHandle("facebook")).toBe(false);
    });

    it("should return empty array for invalid URLs", async () => {
      const result = await adapter.scrape("javascript:alert(1)", "test");
      expect(result).toEqual([]);
    });
  });

  describe("FacebookScraperAdapter", () => {
    const adapter = new FacebookScraperAdapter();

    it("should handle 'facebook' type only", () => {
      expect(adapter.canHandle("facebook")).toBe(true);
      expect(adapter.canHandle("html")).toBe(false);
      expect(adapter.canHandle("instagram")).toBe(false);
    });

    it("should return empty array when no API token is set", async () => {
      const result = await adapter.scrape("https://facebook.com/test", "test");
      expect(result).toEqual([]);
    });
  });

  describe("InstagramScraperAdapter", () => {
    const adapter = new InstagramScraperAdapter();

    it("should handle 'instagram' type only", () => {
      expect(adapter.canHandle("instagram")).toBe(true);
      expect(adapter.canHandle("facebook")).toBe(false);
      expect(adapter.canHandle("html")).toBe(false);
    });

    it("should return empty array when no API token is set", async () => {
      const result = await adapter.scrape("https://instagram.com/test", "test");
      expect(result).toEqual([]);
    });
  });

  describe("RssScraperAdapter", () => {
    const adapter = new RssScraperAdapter();

    it("should handle 'rss' type only", () => {
      expect(adapter.canHandle("rss")).toBe(true);
      expect(adapter.canHandle("html")).toBe(false);
    });

    it("should return empty array for invalid URLs", async () => {
      const result = await adapter.scrape("not-a-url", "test");
      expect(result).toEqual([]);
    });
  });
});
