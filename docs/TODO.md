# Cal🔥Caliente — Project TODO & Roadmap

**Last Audited:** 2026-06-10 (after v1.9: engagement RSVP + share extension)
**Test Coverage:** 549 passing, 7 skipped (556 total across 37 files)

---

## 🔧 Manus runbook — populate `.env` + rebuild the DB (2026-06-13)

**Why:** the `.env` system (`scripts/load-env.js` + `dotenv`) was added but **never
populated on Manus**. That is the only blocker — not SSL, and not the app-secret list
Manus guessed. `npm run db:reset` reads exactly **one** variable: `DATABASE_URL`.

**Read before starting:**
- **Step 0 is done by the repo owner on their machine — NOT by Manus.** Manus must
  **never run `git commit` or `git push` in this repo** (it has corrupted history here
  before). Manus starts at **step 1**, only after the owner has pushed and Manus has
  run `git pull`.
- Run **every** command from the **project root** (the folder containing `package.json`).
- `db:reset` and `scrape:now` are safe to run more than once.

0. [ ] **(Repo owner, local — not Manus.)** Commit & push `scripts/reset-db.ts`,
   `scripts/scrape-now.ts`, and the new `package.json` scripts. Then on Manus: `git pull`.

1. [ ] **Write `.env` from the injected env vars.** ⚠️ This OVERWRITES any existing `.env`.
   ```bash
   for k in DATABASE_URL JWT_SECRET OAUTH_SERVER_URL VITE_APP_ID OWNER_OPEN_ID \
            BUILT_IN_FORGE_API_URL BUILT_IN_FORGE_API_KEY \
            EXPO_PUBLIC_OAUTH_PORTAL_URL EXPO_PUBLIC_OAUTH_SERVER_URL EXPO_PUBLIC_APP_ID; do
     v="$(printenv "$k")" && [ -n "$v" ] && printf '%s=%s\n' "$k" "$v"
   done > .env
   ```

2. [ ] **Confirm `DATABASE_URL` is in `.env`:**
   ```bash
   grep '^DATABASE_URL=' .env || echo "MISSING"
   ```
   - If it prints the `DATABASE_URL=...` line → good, go to step 3.
   - If it prints `MISSING` → add it by hand from the Manus Secrets panel (keep any
     `?ssl=...` the DB needs — TiDB Cloud requires TLS), then re-run this check:
     ```bash
     echo 'DATABASE_URL=mysql://USER:PASS@HOST:4000/DBNAME?ssl={"rejectUnauthorized":true}' >> .env
     ```

3. [ ] **Test the connection + schema (changes nothing):**
   ```bash
   npm run db:reset -- --verify-only
   ```
   - **Success:** last line is `✅ Schema verified ...`.
   - **If it fails to connect:** `DATABASE_URL` is wrong — fix step 2 and retry.

4. [ ] **Rebuild the DB from migration 0000** (drops all tables, replays migrations, verifies):
   ```bash
   npm run db:reset -- --yes
   ```
   - **Success:** ends with `✅ Schema verified ...`. The DB is now **empty** (0 events,
     0 sources) — that is expected; the next two steps refill it.

5. [ ] **Restart the API server** (redeploy / restart the server process — whatever Manus
   normally uses). Boot logs `[Seed] Ensured 14 default source(s)` — that line is what
   re-creates the sources the reset wiped. Wait until the server is back up before step 6.

6. [ ] **Populate events and verify, in one command:**
   ```bash
   npm run scrape:now
   ```
   - **Success:** the final line is `[Scraper] Cycle complete: N found, M added` with **N > 0**.
   - `Error:` lines for individual sources above it are NORMAL (some feeds fail) — only
     the `Cycle complete` summary matters.
   - **If it prints `Found 0 active sources`:** the server restart in step 5 didn't seed —
     repeat step 5, then re-run this.


---

## 🔜 Up next (priority order)
 
### 1. ✅ User-submitted events — shipped v1.8 (manual form)
Done — see "v1.8" under Verified complete. Descoped from the original
screenshot/voice → LLM-extract idea to a **plain manual form** (no LLM, no
voice): signed-in users fill title/description/venue/date/link + optional flyer
image, and it saves as a normal `events` row visible to everyone.
**Deferred follow-ups:** LLM/screenshot/voice auto-extract (`extractEventsFromHtml`,
`voiceTranscription.ts` still exist for it), share extension, "my submissions"
list + edit/delete-your-own, and an admin moderation queue (submissions currently
show immediately, flagged `isVerified=false` / "Community submission").

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

### Phase 2: User-submitted events (the screenshot/voice flow)
- [ ] Submit-event UI (image, paste, voice) → server LLM extracts → user confirms → save.
- [x] iOS/Android share extension so "share to Cal Caliente" works from FB/IG/LINE.
  Shipped v1.9 (`expo-share-intent`) — see Verified complete. ⚠️ native-only: needs a
  dev build (`expo prebuild`/EAS); not exercisable in Expo Go or on web.

### Phase 3: Engagement feature
- [x] "Interested" / "Going" buttons on events. Shipped v1.9 (`event_attendance`,
  public counts) — see Verified complete.

### Phase 4: Resilience finishing touches
- [ ] Hand-test failure scenarios (no network, server down, DB crash). Listed in `docs/resilience-audit.md` but never actually exercised.
- [ ] Re-read `docs/api.md` after the next pass — drifted again with v1 changes.

## Possible future additions:
### Translation (optional, not blocking)
- [ ] Bilingual descriptions (EN ↔ JA). Add `descriptionEn` / `descriptionJa` / `descriptionLang` / `descriptionHash` columns to `events`. Detect source language via CJK-character ratio; translate via the same forge LLM with a glossary that preserves dance terminology verbatim (Salsa, Bachata, On1/On2, Cuban, Sensual, etc.). Cache by `descriptionHash` so re-scrapes don't re-translate unchanged events.
  - **Cost:** ~$0.50 one-time backfill, ~$0.15/month ongoing. Single forge call per new/edited event.
  - **Effort:** ~2-3 hours including schema migration + UI fallback chain (`descriptionEn` → `description` → `descriptionJa`).
  - **Why optional:** ship the single-language original first. Most of the audience can read at least one of the two; translation is improvement, not a blocker.

### Source expansion (only if iCal + SalsaVida + LatinDanceCalendar feels thin)
- [ ] **Peatix** — Japanese ticketing site, dominant for paid events. Has a public API. Not yet investigated.
- [ ] **Connpass** — public REST API.
- [ ] **Eventbrite** — public REST API; used by larger congresses.
- [ ] **Individual dance school websites** — same `HtmlScraperAdapter`, just more URLs. Cheapest expansion path.
- [ ] **BMJ Festival ICS** — already noted as having `.ics` references but not yet investigated.

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

### v1.8 — user-submitted events (manual form, shipped 2026-06-10)
- [x] **`submittedByUserId` column** on `events` (nullable; migration `0006`,
  applied locally). Attributes a manual submission to its creator; NULL for
  scraped events. Enables the future "my submissions" / moderation follow-ups.
  *(Migration `0006` was later regenerated to also carry the v1.9 `event_attendance`
  table — the two were combined into a single migration so Manus applies one.)*
- [x] **`events.submit` tRPC mutation** (`protectedProcedure`): strict Zod schema
  mirroring the manual fields (title/startAt required; dance-style + event-type
  enums; http(s)-only link; optional base64 image bounded at 600KB under the 1MB
  request limit). Attributes to `ctx.user.id`, inserts `isVerified=false`, maps a
  dedup-key collision to `CONFLICT` ("already on the calendar").
- [x] **DB helpers** (`server/db.ts`): `getOrCreateSubmissionSource` (a sentinel
  `internal://user-submissions` source — `isActive=false`, hidden from
  `listSources`, satisfies the NOT-NULL `sourceId`) and `insertSubmittedEvent`
  (computes canonicalKey/venueDateKey so submissions dedup like scraped events;
  plain insert, not `upsertEvent`, so a user form never rewrites a scraped row's
  provenance). Both have `*WithDb` variants for unit testing.
- [x] **Image upload**: `expo-image-picker` (`~17.0.11`, web + native; photos
  permission added to `app.config.ts`). Client picks → base64 → `events.submit`
  → server `storagePut` → `imageUrl`. Event-detail screen now renders a hero
  image + a "Community submission" badge (keyed off `submittedByUserId`, not
  `isVerified`, so scraped events aren't mislabelled).
- [x] **Frontend**: new `app/submit.tsx` auth-aware form (sign-in CTA when logged
  out); reachable from a "+ Add" button on the Calendar header and a "Submit an
  Event" card in Settings.
- [x] **Tests**: +11 `events.submit` router tests (auth gate, validation, enums,
  link, oversized image, image-upload forwarding, duplicate→CONFLICT) and a new
  `tests/submitted-event.test.ts` (5) for the db helpers. Suite: **389 passing**.

### v1.9 — engagement (Interested/Going) + share extension (shipped 2026-06-10)
- [x] **`event_attendance` table** — a clean reinstatement of the table created in
  `0002` and dropped in `0003`: `(userId, eventId, status enum('interested','going'),
  …)` with `UNIQUE(userId,eventId)` + an `eventId` index. **Folded into migration
  `0006`** (combined with `submittedByUserId` per request) so Manus runs one migration.
- [x] **Public RSVP, separate from personal Save.** Aggregate interested/going counts
  are visible to everyone (social proof); only the caller's own status is per-user.
  The device-local "Save to My Calendar" favorites (`lib/favorites-context.tsx`) are
  unchanged and stay personal.
- [x] **DB helpers + procedures**: `getEventAttendance` / `setEventAttendance`
  (`*WithDb` variants for tests); `events.attendance` (**public** query — counts +
  `myStatus` via nullable `ctx.user`) and `events.setAttendance` (**protected**;
  `status: null` clears the RSVP; returns the fresh summary). Upsert on the UNIQUE key.
- [x] **Event-detail UI**: Interested / Going pills with live public counts below the
  Save button; tap-again clears; signed-out tap → sign-in prompt (counts still shown).
- [x] **Submit-form prefill** (`app/submit.tsx`): reads `?link` / `?title` / `?text`
  route params to pre-populate fields (web-testable; also the share-extension hand-off).
- [x] **Share extension** (`expo-share-intent` `~5.1.1`, SDK-54 line): config plugin in
  `app.config.ts` (iOS web-URL/text/image + Android `text/*`,`image/*`); root-layout
  `useShareIntent` handler routes a shared URL/text/image into the prefilled submit
  form. ⚠️ **Native-only** — self-disables on web (verified: web bundle still exports),
  but the share target itself needs a dev build (`expo prebuild`/EAS); unverifiable here.
- [x] **Per-card "🔥 N going" badges** (browse-time social proof). `events.attendanceCounts`
  (public, batched — one grouped query over the `eventId` index, input capped at one
  page) feeds the Calendar + Discover cards; `EventCard` renders the badge only when a
  count is > 0. Polled every **5 min** (`refetchInterval: 300_000`) — chosen staleness
  bound; a user's own RSVP invalidates it for instant reflection. No new migration.
- [x] **Tests**: +8 router tests (`events.attendance` ×3, `events.setAttendance` ×5),
  +4 router tests (`events.attendanceCounts`), and `tests/event-attendance.test.ts` (9)
  for the db helpers. Suite: **410 passing**.

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
| User-submitted events | Live — manual `events.submit` form, attributed + `isVerified=false` |
| Engagement | Interested/Going RSVP with public counts (detail + per-card badges); share extension (native, dev-build only) |
| Test files / tests | 37 / 549 passing, 7 skipped |
| Documentation files | 9 (some drift, see "Worth knowing") |
| Open security issues | 0 in main code (the 3 auth-deferred items are now closed) |
| Schema migrations | 7 files, applied locally (0006 = `submittedByUserId` + `event_attendance`, combined; apply to prod Manus-side) |
