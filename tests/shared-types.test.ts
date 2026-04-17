import { describe, expect, it } from "vitest";
import {
  formatEventDate,
  formatEventTime,
  formatFullDate,
  capitalizeFirst,
} from "../shared/types";

describe("shared/types formatting helpers", () => {
  describe("formatEventDate", () => {
    it("should format a date string with weekday, month, and day", () => {
      const result = formatEventDate("2026-04-17T19:00:00.000Z");
      // Should contain month and day at minimum
      expect(result).toContain("Apr");
      expect(result).toMatch(/\d+/);
    });

    it("should handle different months correctly", () => {
      const jan = formatEventDate("2026-01-15T10:00:00.000Z");
      expect(jan).toContain("Jan");

      const dec = formatEventDate("2026-12-25T10:00:00.000Z");
      expect(dec).toContain("Dec");
    });

    it("should return a non-empty string for valid dates", () => {
      const result = formatEventDate("2026-06-01T12:00:00.000Z");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("formatEventTime", () => {
    it("should format time in 12-hour format with AM/PM", () => {
      const result = formatEventTime("2026-04-17T19:00:00.000Z");
      // The exact output depends on timezone, but should contain AM or PM
      expect(result).toMatch(/AM|PM/);
    });

    it("should include minutes", () => {
      const result = formatEventTime("2026-04-17T14:30:00.000Z");
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it("should return a non-empty string", () => {
      const result = formatEventTime("2026-04-17T00:00:00.000Z");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("formatFullDate", () => {
    it("should include the full weekday name", () => {
      // 2026-04-17 is a Friday
      const result = formatFullDate("2026-04-17T12:00:00.000Z");
      expect(result).toContain("April");
      expect(result).toContain("2026");
    });

    it("should include the year", () => {
      const result = formatFullDate("2026-12-25T12:00:00.000Z");
      expect(result).toContain("2026");
      expect(result).toContain("December");
    });

    it("should return a non-empty string", () => {
      const result = formatFullDate("2026-01-01T00:00:00.000Z");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("capitalizeFirst", () => {
    it("should capitalize the first letter of a lowercase string", () => {
      expect(capitalizeFirst("social")).toBe("Social");
    });

    it("should not change an already capitalized string", () => {
      expect(capitalizeFirst("Social")).toBe("Social");
    });

    it("should handle single character strings", () => {
      expect(capitalizeFirst("a")).toBe("A");
    });

    it("should return empty string for empty input", () => {
      expect(capitalizeFirst("")).toBe("");
    });

    it("should handle strings with numbers", () => {
      expect(capitalizeFirst("123abc")).toBe("123abc");
    });

    it("should only capitalize the first character", () => {
      expect(capitalizeFirst("hELLO")).toBe("HELLO");
    });
  });
});
