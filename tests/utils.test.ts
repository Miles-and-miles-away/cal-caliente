import { describe, expect, it } from "vitest";
import { isSafeExternalUrl } from "../lib/utils";

describe("isSafeExternalUrl", () => {
  it.each([
    "https://example.com",
    "http://example.com/path?q=1",
    "https://example.com:8443/page#frag",
  ])("permits http(s): %s", (url) => {
    expect(isSafeExternalUrl(url)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<h1>x</h1>",
    "file:///etc/passwd",
    "intent://scan/#Intent;scheme=zxing;end",
    "tel:+15551234567",
    "ftp://example.com/x",
    "manus20260417://event/1",
  ])("rejects non-http scheme %s", (url) => {
    expect(isSafeExternalUrl(url)).toBe(false);
  });

  it("rejects empty / non-string input", () => {
    expect(isSafeExternalUrl("")).toBe(false);
    expect(isSafeExternalUrl(null)).toBe(false);
    expect(isSafeExternalUrl(undefined)).toBe(false);
    expect(isSafeExternalUrl(42)).toBe(false);
  });

  it("rejects strings the URL parser cannot handle", () => {
    expect(isSafeExternalUrl("not a url")).toBe(false);
    expect(isSafeExternalUrl("://malformed")).toBe(false);
  });
});
