# Deployment & Configuration

**Last Updated:** 2026-06-10

---

## Overview

Cal🔥Caliente is one Expo (React Native) codebase that produces **three
independently-deployed artifacts**:

| Artifact | How it's built | Notes |
|----------|----------------|-------|
| **Backend API** (Express + tRPC) | `npm run build` → `dist/index.js` (esbuild) | API-only — does **not** serve the web build |
| **Web app** | Expo static export (`web.output: "static"`) | Hosted separately from the API |
| **Native iOS / Android** | Expo build → IPA / APK | Not built yet — see "Building → Native" |

All three talk to the same backend API and the same Manus OAuth portal for login.

---

## Environment Variables

**Source of truth: [`.env.example`](../.env.example).** Copy it to `.env` (gitignored)
and fill in. Two groups:

- **Server vars** — read by `server/_core/env.ts`; stay on the server.
- **Client vars (`EXPO_PUBLIC_*`)** — ⚠️ **inlined into the JS bundle at build
  time.** Not secret, but they must be present *when you build*, or login breaks at
  runtime. In the Manus preview they're injected automatically; for any build
  **outside** Manus you must provide them yourself.

The most common launch bug: `EXPO_PUBLIC_OAUTH_PORTAL_URL` unset → the "Sign In"
button builds `undefined/app-auth` and goes nowhere.

---

## Local Development

```bash
# Terminal 1 — API server (port 3000, hot reload)
npm run dev:server
# Terminal 2 — Expo Metro / web (port 8081)
npm run dev:metro
```

(`npm run dev` runs both via `concurrently`, but pnpm is broken on some local Node
versions — run them separately if so. See `docs/TODO.md` "Worth knowing".)

---

## Database & Migrations

MySQL (TiDB) via Drizzle ORM. Schema in `drizzle/schema.ts`; migrations in
`drizzle/`. Generate + apply:

```bash
npm run db:push      # drizzle-kit generate && drizzle-kit migrate
```

On first server start, `seedDatabase()` populates default sources if `events` is
empty. **Migrations are applied manually in Manus** — review the SQL first
(migration `0005` required a pre-deploy duplicate check; see its header).

---

## Building

### Backend server

```bash
npm run build    # esbuild → dist/index.js
npm start        # NODE_ENV=production node dist/index.js
```

Host it anywhere Node runs. It needs all **server** env vars and network access to
the DB and the Manus OAuth/forge endpoints.

### Web

```bash
npx expo export --platform web   # → dist/ static site
```

Serve the static output from any host/CDN. Set `EXPO_PUBLIC_API_BASE_URL` to the
backend URL at build time, and add the web origin to `ALLOWED_ORIGINS` (below).

### Native (iOS / Android)

Two paths:

- **Manus Publish (fastest).** The Manus **Publish** button runs the Expo build
  pipeline and produces an APK. Do not build the APK inside the dev sandbox
  (resource exhaustion). This is the intended path today; there is **no `eas.json`
  in the repo** because Manus owns the build.
- **Independent EAS (full store control).** Requires an Expo/EAS account, an
  `eas.json` + EAS `projectId` in `app.config.ts`, `eas-cli`, an Apple Developer
  account ($99/yr) and Google Play account ($25), and signing credentials. Needed
  for App Store / TestFlight / Play Store distribution rather than a raw APK.

---

## 🚀 Pre-launch checklist

Things that block a real public launch (as of 2026-06-10):

- [ ] **Backend hosted at a stable URL** with all server env vars set
      (`DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, forge keys).
- [ ] **Client built with the `EXPO_PUBLIC_*` OAuth vars set** (portal / server /
      app id). Unset = login silently broken. See `.env.example`.
- [ ] **`ALLOWED_ORIGINS` includes the production web domain** — `server/_core/cors.ts`
      only ships localhost + `*.manuspre.computer`. Native apps send no Origin
      header, so this is web-only.
- [ ] **OAuth portal whitelists the production redirect URIs** — the web callback
      (`{API}/api/oauth/callback`) and the native deep link
      (`manus<timestamp>://oauth/callback`). Manus-dashboard step, not code.
- [ ] **`OWNER_OPEN_ID` set** if you want an admin user — otherwise `adminProcedure`
      is unreachable (no user ever gets the `admin` role).
- [ ] **Version / build-number management.** `version` is hardcoded `"1.0.0"` in
      `app.config.ts` with no `versionCode`/`buildNumber`/`runtimeVersion`. Stores
      require an incrementing build number per upload.
- [ ] **Privacy policy + store listing assets** (icon/splash exist; screenshots,
      description, privacy URL do not). Required by both stores.

### Deliberately deferred (don't ship as if working)

- **Push notifications are not wired.** `expo-notifications` is installed but there
  is no token registration or send path; `server/_core/notification.ts` is Manus's
  web `SendNotification`, not Expo Push. The Settings "New Event Alerts" control is a
  **"Coming soon" placeholder**, and `POST_NOTIFICATIONS` (Android) was removed from
  `app.config.ts` until push lands. Restore the toggle + permission together.
- **Microphone / video capabilities removed.** The `expo-audio` (mic) and
  `expo-video` (background-audio / PiP) config plugins were dropped from
  `app.config.ts` — nothing uses them yet, and declaring unused permissions risks
  store rejection. Re-add (with usage strings) when the Phase-2 voice
  event-submission flow ships.
- **Preferences server-sync.** `preferences.get`/`upsert` persist scalar settings,
  but the Settings screen still uses local AsyncStorage. See `docs/TODO.md` Up-next #2.

---

## Monitoring

Console logging by prefix: `[Seed]` (seeding), `[Scraper]` / `[Scraper:HTML]` /
`[Scraper:Facebook]` / `[Scraper:Instagram]` (scrape cycles), `[api]` (port
binding), `[OAuth]` / `[Auth]` (login flow). The `scrape_logs` table is a
persistent audit trail of scraping activity (counts, status, errors, duration).

---

## Key constants

Defined in `shared/constants.ts` (shared frontend/backend):

| Constant | Value | Purpose |
|----------|-------|---------|
| `APP_VERSION` | `"1.0.0"` | App version |
| `API_DEFAULT_PAGE_SIZE` / `API_MAX_PAGE_SIZE` | `50` / `500` | Pagination |
| `API_EVENT_LOOKAHEAD_DAYS` | `60` | Default event lookahead window |
| `SCRAPER_INTERVAL_MS` | `21,600,000` (6h) | Scraper cycle interval |

Geocoding uses the **GSI** (国土地理院) address API — no key required (`server/geocode.ts`).
The display name is **Cal🔥Caliente** (`app.config.ts`); the app targets Japan
(`JAPAN_CITIES`) but is region-expandable.
