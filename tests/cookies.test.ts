import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "../server/_core/cookies";

function makeReq(opts: { protocol?: string; hostname?: string; forwardedProto?: string }): Request {
  return {
    protocol: opts.protocol ?? "http",
    hostname: opts.hostname ?? "localhost",
    headers: opts.forwardedProto ? { "x-forwarded-proto": opts.forwardedProto } : {},
  } as unknown as Request;
}

describe("getSessionCookieOptions — secure / sameSite pairing", () => {
  it("uses secure + SameSite=None on direct https", () => {
    const o = getSessionCookieOptions(makeReq({ protocol: "https", hostname: "app.example.com" }));
    expect(o.secure).toBe(true);
    expect(o.sameSite).toBe("none");
  });

  it("falls back to insecure + SameSite=Lax on plain http with no proxy header", () => {
    // Chrome silently drops None+insecure cookies, so this fallback is what
    // keeps localhost dev login working. Removing it breaks dev silently.
    const o = getSessionCookieOptions(makeReq({ protocol: "http" }));
    expect(o.secure).toBe(false);
    expect(o.sameSite).toBe("lax");
  });

  it("trusts X-Forwarded-Proto: https from a TLS-terminating proxy", () => {
    const o = getSessionCookieOptions(
      makeReq({ protocol: "http", hostname: "app.example.com", forwardedProto: "https" }),
    );
    expect(o.secure).toBe(true);
    expect(o.sameSite).toBe("none");
  });

  it("finds https anywhere in a comma-separated X-Forwarded-Proto chain", () => {
    const o = getSessionCookieOptions(
      makeReq({ protocol: "http", hostname: "app.example.com", forwardedProto: "http, HTTPS" }),
    );
    expect(o.secure).toBe(true);
  });

  it("stays insecure when the proxy chain never saw https", () => {
    const o = getSessionCookieOptions(
      makeReq({ protocol: "http", hostname: "app.example.com", forwardedProto: "http" }),
    );
    expect(o.secure).toBe(false);
    expect(o.sameSite).toBe("lax");
  });

  it("is always httpOnly with path=/", () => {
    const o = getSessionCookieOptions(makeReq({}));
    expect(o.httpOnly).toBe(true);
    expect(o.path).toBe("/");
  });
});

describe("getSessionCookieOptions — cookie domain", () => {
  it("sets the parent domain for a subdomain host (cross-port preview sharing)", () => {
    const o = getSessionCookieOptions(makeReq({ hostname: "3000-abc.manuspre.computer" }));
    expect(o.domain).toBe(".manuspre.computer");
  });

  it("sets no domain for localhost", () => {
    expect(getSessionCookieOptions(makeReq({ hostname: "localhost" })).domain).toBeUndefined();
  });

  it("sets no domain for IPv4 and IPv6 hosts", () => {
    expect(getSessionCookieOptions(makeReq({ hostname: "127.0.0.1" })).domain).toBeUndefined();
    expect(getSessionCookieOptions(makeReq({ hostname: "192.168.1.5" })).domain).toBeUndefined();
    expect(getSessionCookieOptions(makeReq({ hostname: "::1" })).domain).toBeUndefined();
  });

  it("sets no domain for a bare two-part domain (not a subdomain)", () => {
    expect(getSessionCookieOptions(makeReq({ hostname: "example.com" })).domain).toBeUndefined();
  });
});
