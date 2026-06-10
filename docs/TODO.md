# Cal🔥Caliente — Project TODO & Roadmap

**Last Audited:** 2026-06-09 (after v1.7: auth last-mile wired)
**Test Coverage:** 368 passing, 0 skipped

---

## 🎉 v1 shipped

The scraper-to-app pipeline is alive end-to-end. After multiple sessions of building scaffolding, real events are now flowing:

- ✅ canonicalKey schema migration applied to the production DB (`varchar(64)` + index)
- ✅ Lockfile regen committed (`aa9f4e7`); CI green
- ✅ Server restarted in Manus; HTML adapter extracted real Tokyo events from SalsaVida via `forge.manus.im`
- ✅ Cross-source dedup verified: same canonicalKey across SalsaVida + LatinDanceCalendar merges into one row

**The "Manus pattern" is broken.** Until this branch, every event in the app was a hardcoded demo. Now extraction is real.

---

> **v1.6 cleared the data-pipeline backlog** (geocode iCal events, apply migration
> 0005, wire the Map screen). **v1.7 wired auth's last mile** (login/logout UI +
> protected mutations + `preferences` procedures) — see both under Verified
> complete. What remains is user-submitted events.

## 🔜 Up next (priority order)

### 1. User-submitted events (Phase 2) — now unblocked (auth shipped)
Submit-event flow (screenshot / paste / voice → server LLM extract → user confirms
→ save). Building blocks exist: `extractEventsFromHtml`
(`server/_core/event-extractor.ts`), `voiceTranscription.ts`, `imageGeneration.ts`.
Events get attributed to the signed-in user (`ctx.user.id`), which auth now
provides. Full detail under "Later → Phase 2".

### 2. Preferences server-sync (deferred — not worth it yet)
`preferences.get` / `preferences.upsert` ship in v1.7 and persist every **scalar**
setting cleanly (city, distance, station, notifications, theme, …) against the
existing columns. The Settings screen still reads/writes **local AsyncStorage
only**, so nothing consumes the procedures yet. Deliberately *not* built:
- A multi-select sync for dance styles. The screen stores `danceStyles[]` but
  `user_preferences.danceStyleFilter` is single-value `varchar(50)` (default
  `"all"`). We considered widening it to `text` + JSON-array (de)serialization but
  reverted it as premature — no consumer, and YAGNI. Decide the representation when
  the screen actually syncs (or keep dance-style multi-select local-only).
- Hydrate-on-sign-in / write-through-on-change wiring in the screen.

### 3. Remaining v1.5/v1.6 verification (operational, Manus-side — not local code)
- **Data-quality sanity check**: counts by source (~14 active), % of events with
  address / coords / description, extraction failures in `scrape_logs`. (Partly
  covered by the migration 0005 report — Club Salud + Meetup inserting end-to-end.)
- **Confirm the 6h scrape cadence is firing**: `scrape_logs.createdAt` should show
  ~6h gaps. The constant changed in-branch but a long-running deployed server may
  still be on 1h until restarted.

---

## 🔮 Later (real work, less urgent)

### Source expansion (only if iCal + SalsaVida + LatinDanceCalendar feels thin)
- [ ] **Peatix** — Japanese ticketing site, dominant for paid events. Has a public API. Not yet investigated.
- [ ] **Connpass** — public REST API.
- [ ] **Eventbrite** — public REST API; used by larger congresses.
- [ ] **Individual dance school websites** — same `HtmlScraperAdapter`, just more URLs. Cheapest expansion path.
- [ ] **BMJ Festival ICS** — already noted as having `.ics` references but not yet investigated.

### Phase 2: User-submitted events (the screenshot/voice flow)
- [ ] Submit-event UI (image, paste, voice) → server LLM extracts → user confirms → save.
- [ ] On-device LLM (Apple Foundation Models / Gemini Nano via AICore) for capable devices; cloud fallback otherwise.
- [ ] iOS/Android share extension so "share to Cal Caliente" works from FB/IG/LINE.

### Translation (optional, not blocking)
- [ ] Bilingual descriptions (EN ↔ JA). Add `descriptionEn` / `descriptionJa` / `descriptionLang` / `descriptionHash` columns to `events`. Detect source language via CJK-character ratio; translate via the same forge LLM with a glossary that preserves dance terminology verbatim (Salsa, Bachata, On1/On2, Cuban, Sensual, etc.). Cache by `descriptionHash` so re-scrapes don't re-translate unchanged events.
  - **Cost:** ~$0.50 one-time backfill, ~$0.15/month ongoing. Single forge call per new/edited event.
  - **Effort:** ~2-3 hours including schema migration + UI fallback chain (`descriptionEn` → `description` → `descriptionJa`).
  - **Why optional:** ship the single-language original first. Most of the audience can read at least one of the two; translation is improvement, not a blocker.

### Phase 3: Engagement features (later still)
- [ ] "Interested" / "Going" buttons on events.
- [ ] Event recommendations based on saved-favourites pattern.

### Resilience finishing touches
- [ ] Hand-test failure scenarios (no network, server down, DB crash). Listed in `docs/resilience-audit.md` but never actually exercised.
- [ ] Re-read `docs/api.md` after the next pass — drifted again with v1 changes.

---

## ✅ Verified complete

### v1 scraping pipeline
- [x] DB schema with canonicalKey column + index (migration `0004` applied)
- [x] `HtmlScraperAdapter` calls `extractEventsFromHtml` (Gemini Flash via forge), Zod-validated output
- [x] Cross-source dedup via `canonicalKey` — same event from different sources merges
- [x] Detail-page enrichment: same-domain `sourceUrl` → second LLM pass → richer fields, capped at 50/cycle
- [x] Scrape interval 6h, 4-source concurrency, overlap guard, 30-day log retention
- [x] 7 sources seeded (SalsaVida × 6 cities + LatinDanceCalendar Tokyo)

### v1.5 scraping pipeline (migration 0005 applied & verified)
- [x] **iCal adapter** replacing the RSS stub. RRULE expansion (5000-iter safety, 60-day window), Japanese + Latin-script style classification, `eventType` inference, location parsing, URL safety. ~28 tests + real-feed validation.
- [x] **Cross-source venue dedup** via `venueDateKey` (normalized venue + hour). Catches different-titled cross-source duplicates the canonicalKey misses.
- [x] **UNIQUE constraints** on canonicalKey and venueDateKey — closes the upsertEvent race window. Migration `0005` includes pre-deploy duplicate-check warning at the top of the SQL.
- [x] **Race-recovery path** in `upsertEvent`: catches `ER_DUP_ENTRY`, walks `err.cause` chain, re-fetches and merges. Logs a warning when venueDateKey-only match has a different canonicalKey.
- [x] **iCal data-loss policies** documented at top of `ical-parser.ts`: STATUS:CANCELLED dropped, all-day events (VALUE=DATE) dropped, RRULE expansion bounded at 5000 iterations.
- [x] **Recurring-event endAt fallback** to `(DTEND - DTSTART)` when `event.duration` isn't set.
- [x] 7 additional sources seeded (Club Salud × 4 + Meetup × 3) → 14 total.

### v1.6 (shipped 2026-06-05 → 06-06)
- [x] **Migration 0005 applied & verified in Manus** (was Up-next #2). `canonicalKey`
  and `venueDateKey` both confirmed `UNIQUE`; iCal scraper inserting end-to-end
  (Club Salud 54 + 30, Meetup 6 + 10 + 8). Source of truth was
  `docs/MIGRATION_0005_VERIFICATION.md` (commit `b75b813`); its conclusion is folded
  in here since that report is being removed.
- [x] **iCal venue geocoding for the Map screen** (was Up-next #1, commit `a3582d1`).
  `server/geocode.ts` resolves Japanese addresses via **GSI** (国土地理院 / Geospatial
  Information Authority — free, no API key, GeoJSON `[lng, lat]`), cached by address,
  with a polite per-request delay paid only on cache misses. Approximate city-centroid
  pins as fallback. 8 tests (`tests/geocode.test.ts`). (Chose GSI over the doc's
  earlier Nominatim recommendation — Japan-specific, no rate-limit headaches.)
- [x] **Map lat/lng wiring** (was Up-next #3, commit `09baa56`) — city filter on the
  Calendar screen + date-range selector on the Map screen.
- [x] **HTML event descriptions converted to plain text at scrape time** (`d88d0e6`).
- [x] **iCal events link to a browser-viewable calendar day-view** (`9c6afa6`).
- [x] **"Search the Web" (DuckDuckGo) action on event detail** (`6d88088`).

### v1.7 — auth last-mile wired (this branch)
- [x] **Login / logout UI** on the Settings screen (`app/(tabs)/preferences.tsx`):
  Account card calls `startOAuthLogin()` when signed out, shows name/email +
  Sign Out (via `useAuth().logout`) when signed in. `useAuth()` now has real
  consumers; `startOAuthLogin()` is reachable.
- [x] **`sources.add` / `toggle` / `delete` + `auth.logout` → `protectedProcedure`**
  (`server/routers.ts`). The old `TODO(auth)` marker is gone; unauthenticated
  writes are rejected with UNAUTHORIZED before the resolver runs.
- [x] **`preferences.get` / `preferences.upsert` tRPC procedures** added (protected,
  keyed by `ctx.user.id` — no client-supplied userId/IDOR). Input validated by a
  `.strict()` Zod schema mirroring the existing db columns; persists every scalar
  setting as-is (no schema change). *(Screen still uses local AsyncStorage — sync
  is deferred, see Up-next #2.)*
- [x] **Sites screen made auth-aware** (`app/sites.tsx`): sign-in CTA + hidden
  add/+ button when signed out, disabled toggle / hidden delete, and `onError`
  handlers on all three mutations so a session-expiry mid-use shows a clear
  "Sign in required" alert instead of failing silently.
- [x] **`auth.logout` test un-skipped** (`tests/auth.logout.test.ts`) — the lone
  skip is gone. +11 new router tests (auth-gating ×4, `preferences` ×7). Suite:
  **368 passing, 0 skipped**.

### Security hardening
- [x] CORS allowlist (replaces dangerous origin reflection) — 11 tests
- [x] SSRF protection (`safeFetch` blocks RFC1918/loopback/link-local + manual redirect validation) — 29 tests
- [x] XSS hardening on Leaflet iframe (JSON-blob extraction) — 4 tests
- [x] `Linking.openURL` validation (`isSafeExternalUrl`) — 12 tests
- [x] Date-input bypass closed in Zod schemas
- [x] Mass-assignment guard on `upsertUserPreferences`
- [x] Rate limiting on tRPC routes (1500/15min queries, 100/15min mutations) — 4 tests
- [x] `trust proxy: 1` so X-Forwarded-For can't be spoofed past one hop

### Frontend resilience
- [x] Error boundary at app root
- [x] Network state detection + offline indicator
- [x] AsyncStorage cache module — 17 tests
- [x] Cache integration into Calendar + Discover screens (`useCachedQuery` hook) — 6 tests
- [x] React Query: 3 retries with exponential backoff (queries), 1 retry (mutations)
- [x] Strict route param parsing on `event/[id]`
- [x] Favorites context with corrupted-storage recovery
- [x] "Show past events" toggle on Calendar's My Calendar mode

### Backend tests
- [x] tRPC router integration tests (`tests/routers.test.ts`) — 22 tests covering input validation, URL/enum guards, db.ts forwarding
- [x] `upsertEvent` race recovery + dedup tests (`tests/upsert-event.test.ts`) — 19 tests including mocked-DB integration covering happy-path, canonical-match merge, race-loss recovery (with `err.cause` chain), winner-deleted-between-failure-and-refetch bail, non-duplicate error pass-through, and venueDateKey-only-match warning

### Infrastructure
- [x] CI workflow (typecheck + tests on every PR)
- [x] `audit` workflow surfacing high-severity advisories (non-blocking)
- [x] Branch protection on `main` requiring `check` job
- [x] Vitest path-alias config
- [x] Lockfile regenerated and committed; CI green

### Core app (pre-existing, spot-checked)
- [x] DB schema: events, event_sources, scrape_logs, user_preferences, users
- [x] tRPC backend: events / sources / scraper / auth routers
- [x] 4 tab screens + event detail + sites management
- [x] Favorites system, "All Events / My Calendar" toggle
- [x] Pull-to-refresh + manual refresh button on each main screen

---

## ⚠️ Worth knowing (subtle gotchas)

- **iCal events have no lat/lng.** No detail-page enrichment runs for the iCal path (by design — the adapter is LLM-free). Club Salud is our biggest source and ships rich `venueAddress` text but no coords, so its events don't render on the Map screen. Geocoding is "Up next #1".
- **All-day iCal events are dropped, including legitimate multi-day festivals** published as `VALUE=DATE`. Documented at top of `ical-parser.ts`. If we start losing real festivals, the fix is to interval-expand VALUE=DATE rather than default to an evening time.
- **RRULE safety counter is 5000 iterations per recurring event.** Patterns denser than ~daily over many years would silently miss occurrences. The parser logs a warning when the counter trips, but the missing rows never enter the DB.
- **Same-venue parallel events at the same hour can merge.** If Club Salud runs a Salsa Class 7-8pm and a Bachata Workshop 7-8pm in different rooms, both have the same `venueDateKey` and `upsertEvent` merges them. Logs a warning via `[upsertEvent] venueDateKey-only match: ...` so we'd see it in production. Cost: cross-source dedup wins more often than this loses.
- **Cross-language venue names don't dedup.** `Club Salud` (HTML scraper) vs `日暮里サルー` (iCal) normalize to different `venueDateKey` values. No fix without an alias table or LLM clustering.
- **Facebook / Instagram scraper adapters are stubs returning `[]`.** They check for API tokens that, in practice, you won't be issued by Meta for a small calendar app. Don't expect data. The user-submission/share-extension flow (Phase 2) is the realistic substitute.
- **`docs/api.md` has drifted** from the actual code through several refactors. Worth a re-read pass when there's time.
- **`drizzle/relations.ts` is 27 bytes.** Drizzle generated it during `db:push`; we don't use it, leave alone.
- **Node 23 corepack signature bug** breaks `pnpm` locally on this Mac. Workarounds: use absolute path `/opt/homebrew/bin/pnpm`, or downgrade to Node 22 LTS (recommended; CI is on 22 anyway).

---

## 🚫 Explicitly not doing (with reasons)

- **Facebook / Instagram public-page scraping.** Meta's public APIs don't expose feed data; HTML is JS-rendered and ToS-violating. Screenshot-share is the realistic substitute (Phase 2).
- **latindancecalendar.com beyond static HTML.** Main listing is JS-rendered. We already get 2-3 festivals from the server-rendered "Featured deals" section. Going deeper requires Playwright — not justified.
- **goandance.com.** Verified Europe-only; zero Japan events.
- **Hourly scraping.** Reduced to 6h. SalsaVida data doesn't change hourly; the LLM cost wasn't justified.
- **Peatix.** Ticketing endpoint, not a discovery source. Individual event pages have rich `<meta itemprop>` microdata (startDate, address, lat/lng, price/currency) parseable without JS — but search, tag, and organizer listing pages are empty 745-byte SPA shells requiring headless rendering. Every salsa/bachata event found on Peatix (La Bachata Tokyo Festival, VIVELATINO Okinawa, Tromboranga Tour) is already captured upstream via Google Calendar iCal feeds or Meetup. Organizers publish schedules elsewhere and link to Peatix for ticket sales. Optional future enrichment: follow `peatix.com` URLs scraped from Google Calendar `DESCRIPTION` fields to pull ticket prices via meta tags.

---

## 📊 Honest snapshot

| Metric | Value |
|--------|-------|
| Real adapters with working extraction | 2 (HTML via LLM + iCal) |
| Stub adapters | 2 (Facebook, Instagram — RSS replaced by iCal) |
| Sources seeded | 14 (SalsaVida ×6 + LatinDanceCalendar + Club Salud ×4 + Meetup ×3) |
| Events in production DB | Real — iCal insert verified (migration 0005 report) |
| iCal venue geocoding | Live via GSI, address-cached (`server/geocode.ts`) |
| Auth | Wired — OAuth login/logout UI live, mutations gated by `protectedProcedure` |
| Test files / tests | 20 / 368 passing, 0 skipped |
| Documentation files | 9 (some drift, see "Worth knowing") |
| Open security issues | 0 in main code (the 3 auth-deferred items are now closed) |
| Schema migrations | 5/5 applied & verified |
