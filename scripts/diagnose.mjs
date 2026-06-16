/**
 * diagnose.mjs — one-shot, full-stack diagnostic for "the app shows no events".
 *
 * Runs with plain node (no tsx/esbuild): `node scripts/diagnose.mjs [previewOrigin]`
 * or `npm run diagnose -- https://8081-<id>.<region>.manus.computer`
 *
 * Prints, in one log, every layer's ground truth so we don't have to round-trip:
 *   1. Code/version    — is this the current commit? is the CORS fix present?
 *   2. Env/config      — EXPO_PUBLIC_API_BASE_URL, DATABASE_URL (masked)
 *   3. Database        — event/source counts (direct query)
 *   4. Local API       — localhost:3000 events.list (+ CORS header)
 *   5. Public API      — the URL the browser actually calls (+ CORS, as the browser sees it)
 *   6. Served bundle   — which API host is baked into the web bundle (stale-bundle check)
 *
 * The one thing a script CAN'T see — whether the React app fires the query — is
 * covered by the browser-console snippet printed at the end.
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const log = (s = "") => console.log(s);
const section = (t) => {
  log();
  log("━━━━━ " + t + " ━━━━━");
};
const sh = (cmd) => {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "(command failed)";
  }
};
const mask = (u) => {
  try {
    const x = new URL(u);
    return `${x.protocol}//${x.username ? x.username + "@" : ""}${x.host}${x.pathname}`;
  } catch {
    return "(unparseable)";
  }
};

const LOCAL_API = `http://localhost:${process.env.PORT || 3000}`;
const METRO = `http://localhost:${process.env.EXPO_PORT || 8081}`;
const PUBLIC_API = (process.env.EXPO_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
// Preview origin: arg #1, else derive from the public API URL (3000- → 8081-).
const PREVIEW_ORIGIN =
  process.argv[2] || (PUBLIC_API ? PUBLIC_API.replace(/\/\/3000-/, "//8081-") : "");

const EVENTS_QS =
  "batch=1&input=" + encodeURIComponent(JSON.stringify({ "0": { json: { limit: 1 } } }));

// ── 1. CODE / VERSION ─────────────────────────────────────────────────────────
section("1. CODE / VERSION  (is Manus on our code?)");
log("HEAD:            " + sh("git rev-parse --short HEAD"));
log("branch:          " + sh("git rev-parse --abbrev-ref HEAD"));
log("working tree:    " + (sh("git status --porcelain") ? "DIRTY (uncommitted changes)" : "clean"));
log("HEAD vs origin/main (ahead<TAB>behind): " + sh("git rev-list --left-right --count HEAD...origin/main"));
log("top commit:      " + sh("git log --oneline -1"));
const corsSrc = existsSync("server/_core/cors.ts") ? readFileSync("server/_core/cors.ts", "utf8") : "";
log("CORS fix present (matches manus.computer): " + (corsSrc.includes("manus(pre)?") ? "YES" : "NO — OLD CODE, pull origin/main"));

// ── 2. ENV / CONFIG ───────────────────────────────────────────────────────────
section("2. ENV / CONFIG");
log("EXPO_PUBLIC_API_BASE_URL: " + (process.env.EXPO_PUBLIC_API_BASE_URL || "(unset → client uses 8081→3000 hostname rewrite)"));
log("DATABASE_URL:             " + (process.env.DATABASE_URL ? mask(process.env.DATABASE_URL) : "(unset)"));
log("derived preview origin:   " + (PREVIEW_ORIGIN || "(unknown — pass as arg #1 for the CORS check)"));

// ── 3. DATABASE (direct) ──────────────────────────────────────────────────────
section("3. DATABASE (direct query)");
if (process.env.DATABASE_URL) {
  try {
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    const n = async (q) => Number((await conn.query(q))[0][0].n);
    log("events (not cancelled): " + (await n("SELECT COUNT(*) n FROM events WHERE isCancelled=0")));
    log("events (June 2026):     " + (await n("SELECT COUNT(*) n FROM events WHERE isCancelled=0 AND startAt>='2026-06-01' AND startAt<'2026-07-01'")));
    log("event_sources:          " + (await n("SELECT COUNT(*) n FROM event_sources")));
    await conn.end();
  } catch (e) {
    log("DB ERROR: " + e.message + "   (TiDB needs TLS in the URL: ?ssl={\"rejectUnauthorized\":true})");
  }
} else {
  log("skipped — DATABASE_URL not set");
}

// ── shared API probe ──────────────────────────────────────────────────────────
async function probe(label, base, origin) {
  if (!base) {
    log(`${label}: (no URL)`);
    return;
  }
  try {
    const res = await fetch(`${base}/api/trpc/events.list?${EVENTS_QS}`, origin ? { headers: { Origin: origin } } : {});
    const allow = res.headers.get("access-control-allow-origin") || "(none)";
    let events = "?";
    try {
      const j = await res.json();
      const d = j?.[0]?.result?.data?.json ?? j?.[0]?.result?.data;
      events = Array.isArray(d) ? d.length + " events" : JSON.stringify(j).slice(0, 120);
    } catch {
      events = "(non-JSON body)";
    }
    log(`${label}: HTTP ${res.status} | ${events} | Allow-Origin: ${allow}`);
  } catch (e) {
    log(`${label}: FETCH FAILED — ${e.message}`);
  }
}

// ── 4. LOCAL API ──────────────────────────────────────────────────────────────
section("4. LOCAL API (localhost — does the server itself serve events?)");
await probe("localhost", LOCAL_API, PREVIEW_ORIGIN || undefined);

// ── 5. PUBLIC API (what the browser calls) ─────────────────────────────────────
section("5. PUBLIC API (the exact URL + Origin the browser uses)");
if (PUBLIC_API) await probe("public  ", PUBLIC_API, PREVIEW_ORIGIN || undefined);
else log("skipped — EXPO_PUBLIC_API_BASE_URL not set (so there's no public URL to test)");

// ── 6. SERVED WEB BUNDLE (stale-bundle check) ──────────────────────────────────
section("6. SERVED WEB BUNDLE (which API host is actually baked in?)");
try {
  const html = await (await fetch(METRO)).text();
  const scripts = [...html.matchAll(/(?:src|href)="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
  log(`Metro reachable, ${scripts.length} script ref(s) in HTML`);
  const hosts = new Set();
  for (const s of scripts.slice(0, 8)) {
    const u = s.startsWith("http") ? s : METRO + (s.startsWith("/") ? s : "/" + s);
    try {
      const js = await (await fetch(u)).text();
      for (const m of js.matchAll(/https?:\/\/(?:3000-|localhost)[a-z0-9.\-:]*manus[a-z]*\.computer|http:\/\/localhost:\d+/g)) hosts.add(m[0]);
    } catch {
      /* skip unfetchable chunk */
    }
  }
  log("API host(s) found in bundle: " + (hosts.size ? [...hosts].join(", ") : "(none — either unset/relative, or not in the scanned chunks)"));
  log("→ compare this to EXPO_PUBLIC_API_BASE_URL above. If it shows an OLD sandbox id, the bundle is STALE — rebuild with `expo start -c`.");
} catch (e) {
  log("Metro not reachable at " + METRO + " — skipped (" + e.message + ")");
}

// ── browser-side step (a script can't see this) ────────────────────────────────
section("7. BROWSER (paste in the preview's DevTools console)");
log("// what host is the app on, and does a direct API call work?");
log("console.log('page origin:', location.origin);");
log(
  `fetch(${JSON.stringify((PUBLIC_API || "https://3000-<id>.<region>.manus.computer"))}+"/api/trpc/events.list?${EVENTS_QS}")` +
    `.then(r=>r.json()).then(j=>console.log("manual fetch OK:",JSON.stringify(j).slice(0,200))).catch(e=>console.log("manual fetch ERR:",e.message))`,
);
log("// Then check the Network tab: is there a request to /api/trpc/events.list at all?");

log();
log("━━━━━ done ━━━━━");
