import { describe, expect, it } from "vitest";
import { buildJstIso, isSafeExternalUrl } from "../lib/utils";

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

describe("buildJstIso (submit form date+time)", () => {
  it("builds a JST-offset ISO string from valid parts", () => {
    expect(buildJstIso("2026-07-10", "19:00")).toBe("2026-07-10T19:00:00+09:00");
  });

  it.each([
    ["7/10/2026", "19:00"],
    ["2026-7-10", "19:00"],
    ["2026-07-10", "7pm"],
    ["2026-07-10", "19:0"],
    ["", "19:00"],
    ["2026-07-10", ""],
  ])("rejects malformed input (%s, %s)", (d, t) => {
    expect(buildJstIso(d, t)).toBeNull();
  });

  it("rejects shapes that pass the regex but are not real dates/times", () => {
    expect(buildJstIso("2026-13-45", "19:00")).toBeNull();
    expect(buildJstIso("2026-07-10", "25:99")).toBeNull();
  });
});
