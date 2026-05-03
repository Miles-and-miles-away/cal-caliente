import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPrivateIp, safeFetch } from "../server/scraper";

describe("isPrivateIp", () => {
  it.each([
    ["127.0.0.1", true],
    ["10.0.0.1", true],
    ["10.255.255.255", true],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["192.168.1.1", true],
    ["169.254.169.254", true],   // AWS/GCP metadata
    ["0.0.0.0", true],
    ["224.0.0.1", true],         // multicast
  ])("blocks private IPv4 %s", (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });

  it.each([
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["172.15.255.255", false],   // just below 172.16/12
    ["172.32.0.0", false],       // just above 172.16/12
    ["192.167.255.255", false],
  ])("permits public IPv4 %s", (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });

  it.each([
    ["::1", true],
    ["::", true],
    ["fe80::1", true],            // link-local
    ["fc00::1", true],            // unique-local
    ["fd00::1", true],            // unique-local
    ["ff00::1", true],            // multicast
    ["::ffff:127.0.0.1", true],   // IPv4-mapped loopback
    ["::ffff:10.0.0.1", true],    // IPv4-mapped private
  ])("blocks private IPv6 %s", (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });

  it.each([
    ["2001:4860:4860::8888", false],  // Google DNS
    ["::ffff:8.8.8.8", false],        // IPv4-mapped public
  ])("permits public IPv6 %s", (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });
});

describe("safeFetch", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("rejects non-http(s) URLs without making a request", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    await expect(safeFetch("javascript:alert(1)")).rejects.toThrow(
      /non-http/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects literal private IP hosts before fetching", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    await expect(safeFetch("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      /private/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses redirect: 'manual' so redirects are validated per-hop", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("ok", { status: 200 }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;
    await safeFetch("http://1.1.1.1/");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe("manual");
  });

  it("refuses to follow a redirect to a private IP", async () => {
    const fetchSpy = vi
      .fn()
      // First hop: public host responds with 302 to internal metadata
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "http://169.254.169.254/latest/meta-data" },
        }),
      );
    global.fetch = fetchSpy as unknown as typeof fetch;
    await expect(safeFetch("http://1.1.1.1/")).rejects.toThrow(/private/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect to another public host", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { Location: "http://8.8.8.8/" },
        }),
      )
      .mockResolvedValueOnce(new Response("done", { status: 200 }));
    global.fetch = fetchSpy as unknown as typeof fetch;
    const res = await safeFetch("http://1.1.1.1/");
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
