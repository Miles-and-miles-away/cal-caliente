# Firestore schema (contract — keep functions, rules, app, and seed script in sync)

Project: development runs emulator-first against project id
`demo-cal-caliente`. A real `cal-caliente` project is configured
(`lib/firebase_options.dart`) but nothing is deployed to it yet.
All timestamps are Firestore `Timestamp`. All enums are lowercase strings from the old
Drizzle enums (see lib/core/constants.dart).

## events/{canonicalKey}
Doc ID = canonicalKey = sha256(normalizedTitle | YYYY-MM-DD).slice(0,32) — dedup by construction.
```
title: string            // required, <=500
description: string|null
danceStyle: string       // salsa|bachata|zouk|kizomba|merengue|cha-cha-cha|cumbia|reggaeton|samba|tango|rumba|mambo|afro-latin|mixed|other
eventType: string        // social|workshop|performance|festival|class|congress|bootcamp|other
startAt: Timestamp       // required
endAt: Timestamp|null
isAllDay: bool           // default false; all-day events anchored to JST 00:00 (+09:00)
venueName: string|null
venueAddress: string|null
city: string|null        // one of JAPAN_CITIES values
prefecture: string|null
latitude: number|null
longitude: number|null
nearestStation: string|null
imageUrl: string|null
sourceUrl: string|null
price: string|null
organizer: string|null
sourceId: string|null    // sources doc id; null for user submissions
submittedByUid: string|null
isVerified: bool         // scraped = true, user-submitted = false
isCancelled: bool
canonicalKey: string     // == doc id
venueDateKey: string|null // sha256(normalizedVenue | YYYY-MM-DDTHH).slice(0,32); second dedup axis (query, not constraint)
createdAt: Timestamp
updatedAt: Timestamp
```
Client reads only (rules deny client writes). Writes come from callables/scraper (Admin SDK).

## events/{id}/attendance/{uid}
```
status: string           // interested|going
updatedAt: Timestamp
```
Public read (aggregate count() queries for social proof). Write/delete only by owner uid.

## sources/{autoId}
```
name: string             // <=255
url: string              // https/http, <=768
sourceType: string       // facebook|instagram|rss|html|custom
region: string           // default "japan"
isActive: bool
isUserAdded: bool        // false for the 14 seeded defaults
addedByUid: string|null  // null for seeded defaults
lastScrapedAt: Timestamp|null
createdAt: Timestamp
```
Public read. Create via `registerSource` callable only. Update: owner may toggle `isActive` only.
Delete: owner, and only if isUserAdded.

## sources/{id}/scrapeLogs/{autoId}
```
status: string           // success|error|partial
eventsFound: number
eventsAdded: number
errorMessage: string|null
durationMs: number|null
createdAt: Timestamp
```
Public read, no client writes.

## users/{uid}
Prefs embedded (replaces user_preferences table). Favorites moved server-side
(was device-local AsyncStorage in the RN app) since anonymous auth means everyone has a uid.
```
displayName: string|null
favoriteEventIds: string[]   // "My Calendar" saves
prefs: {
  city: string,              // ""=all
  maxDistanceKm: number,     // default 30
  nearestStation: string,
  danceStyles: string[],     // empty = all
  eventTypes: string[],      // empty = all
  theme: string,             // light|dark|system
}
createdAt: Timestamp
updatedAt: Timestamp
```
Owner read/write only.

## Cloud Functions
- `submitEvent` (callable, auth required): validated user event submission; computes
  canonicalKey/venueDateKey; CONFLICT if either matches an existing event; writes events doc.
- `registerSource` (callable, auth required): validates name/url (https/http, public host),
  CONFLICT if url exists; creates sources doc with addedByUid.
- `scrapeSources` (scheduled, daily 03:00 Asia/Tokyo): RSS/iCal adapter (ical.js) + HTML
  adapter (Gemini Flash via GEMINI_API_KEY; skips gracefully if unset). Upserts events by
  canonicalKey, checks venueDateKey, writes scrapeLogs, updates lastScrapedAt.
- `scrapeNow` (callable, **admin only** — requires `admin: true` custom claim): manual
  trigger of one source or all. Grant the claim once with the Admin SDK:
  `admin.auth().setCustomUserClaims(uid, { admin: true })`.
- `adminDeleteUser` (callable, **admin only**): deletes a user's auth account,
  users/{uid} doc, their user-added sources, and their RSVPs (O(events) probe —
  fine at hundreds of events). Their submitted events stay as community content.

## Admin panel (in-app)
The `admin: true` claim unlocks an Admin entry in Preferences → `/admin`:
usage stats (count() aggregates incl. collection-group RSVPs), scrape health
(latest 20 scrapeLogs via collection-group query) + "Scrape now", community
submissions (cancel/un-cancel toggle, permanent delete), user list (delete via
`adminDeleteUser`). Every destructive action requires typing a confirmation
phrase (`DELETE <last-4-of-id>` / `DELETE USER <last-4>`), so a pocket tap
can't fire it. Rules grant admin: event update/delete, any-source toggle,
user-added-source delete (seeded defaults protected), users read,
collection-group attendance/scrapeLogs read.

Local admin login: `admin@calcaliente.test`, seeded only when
`SEED_ADMIN_PASSWORD` is set (`SEED_ADMIN_PASSWORD=... npm run seed`). The same
value goes to the app as `--dart-define=ADMIN_PASSWORD` for the debug swap
button; `make run-ios` and `make itest` forward it. There is no email/password
login UI. In production, grant the claim to your real account instead.

## Dropped from the RN app (deliberate)
- image upload on submit (Storage surface; scraped imageUrl still displayed)
- FB/IG adapters (stubs), push notifications (was "coming soon" stub)
- attendance-count polling on list cards (counts shown on detail screen only)
- per-user server prefs like notifyBeforeHours/maxWalkMinutes (unused by any feature)
