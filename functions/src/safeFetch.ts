import { lookup as dnsLookup } from "node:dns/promises";
import {
  ALLOWED_URL_PROTOCOLS,
  MAX_SOURCE_URL_LENGTH,
} from "./constants";

// ─── URL Validation ──────────────────────────────────────────────────────────
// Ported from the old server/scraper.ts.

export function isValidScraperUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  if (url.length > MAX_SOURCE_URL_LENGTH) return false;
  try {
    const parsed = new URL(url);
    return (ALLOWED_URL_PROTOCOLS as readonly string[]).includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function sanitizeUrl(url: string): string | null {
  if (!isValidScraperUrl(url)) return null;
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

// ─── SSRF protection ────────────────────────────────────────────────────────
// Block requests to private, loopback, link-local, and metadata-service IPs.
// `fetch()` follows redirects by default; we set `redirect: "manual"` and
// re-validate every hop ourselves, otherwise a public URL could redirect to
// `http://169.254.169.254/` (AWS/GCP metadata) and exfiltrate creds.
//
// This check is best-effort against DNS rebinding (the IP can change between
// our lookup and the OS resolver's lookup inside fetch). Mitigations like
// pinning the resolved IP into the request would require a custom HTTPS agent;
// not worth the complexity until we have a real exposure.

const MAX_REDIRECTS = 5;

export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  // IPv4
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10) return true;                              // 10.0.0.0/8
    if (a === 127) return true;                             // loopback
    if (a === 0) return true;                               // 0.0.0.0/8
    if (a === 169 && b === 254) return true;                // link-local + AWS/GCP metadata
    if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                // 192.168.0.0/16
    if (a >= 224) return true;                              // multicast / reserved
    return false;
  }
  // IPv6 — block loopback, link-local, unique-local, IPv4-mapped private ranges
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("fe80:")) return true;                  // link-local
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // unique-local
  if (v6.startsWith("ff")) return true;                     // multicast
  if (v6.startsWith("::ffff:")) {
    // IPv4-mapped IPv6. The embedded IPv4 may be dotted (::ffff:169.254.169.254)
    // or, as Node's URL parser re-encodes it, two hex groups (::ffff:a9fe:a9fe).
    const rest = v6.slice("::ffff:".length);
    const hex = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return isPrivateIp(rest);
  }
  return false;
}

export async function assertPublicHost(hostname: string): Promise<void> {
  // `new URL(...).hostname` keeps the brackets on an IPv6 literal ("[::1]");
  // strip them so the IP checks below see a bare address — otherwise every
  // bracketed literal (loopback, link-local, metadata) sails through as "not
  // an IP" and defeats the SSRF guard.
  const host = hostname.replace(/^\[/, "").replace(/\]$/, "");
  // If hostname is itself a literal IP, check directly.
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new Error(`Refusing to fetch private host: ${hostname}`);
    return;
  }
  const results = await dnsLookup(host, { all: true });
  for (const r of results) {
    if (isPrivateIp(r.address)) {
      throw new Error(`Refusing to fetch ${hostname} — resolves to private ${r.address}`);
    }
  }
}

export async function safeFetch(initialUrl: string, init: RequestInit = {}): Promise<Response> {
  let url = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(url);
    if (!(ALLOWED_URL_PROTOCOLS as readonly string[]).includes(parsed.protocol)) {
      throw new Error(`Refusing non-http(s) URL: ${parsed.protocol}`);
    }
    await assertPublicHost(parsed.hostname);

    const res = await fetch(url, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      url = new URL(loc, url).toString();
      continue;
    }
    return res;
  }
  throw new Error(`Too many redirects (>${MAX_REDIRECTS})`);
}
