import { describe, expect, it } from "vitest";
import { escapeLikePattern } from "../server/db";

describe("server/db helpers", () => {
  describe("escapeLikePattern", () => {
    it("should return the same string if no special characters", () => {
      expect(escapeLikePattern("hello world")).toBe("hello world");
    });

    it("should escape percent signs", () => {
      expect(escapeLikePattern("100%")).toBe("100\\%");
      expect(escapeLikePattern("%drop%")).toBe("\\%drop\\%");
    });

    it("should escape underscores", () => {
      expect(escapeLikePattern("user_name")).toBe("user\\_name");
      expect(escapeLikePattern("__init__")).toBe("\\_\\_init\\_\\_");
    });

    it("should escape backslashes", () => {
      expect(escapeLikePattern("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("should escape multiple special characters together", () => {
      expect(escapeLikePattern("%_\\")).toBe("\\%\\_\\\\");
    });

    it("should handle empty strings", () => {
      expect(escapeLikePattern("")).toBe("");
    });

    it("should handle strings with only special characters", () => {
      expect(escapeLikePattern("%%%")).toBe("\\%\\%\\%");
    });

    it("should not escape other special characters", () => {
      expect(escapeLikePattern("hello@world!")).toBe("hello@world!");
      expect(escapeLikePattern("price: $100")).toBe("price: $100");
    });

    it("should handle Japanese characters", () => {
      expect(escapeLikePattern("サルサ")).toBe("サルサ");
      expect(escapeLikePattern("東京%")).toBe("東京\\%");
    });
  });
});
