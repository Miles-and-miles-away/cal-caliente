# Cal Caliente (Flutter)

Salsa & Bachata Japan event calendar — Flutter + Firebase sister repo of
[`cal-caliente`](../cal-caliente) (Expo/RN + Express/tRPC + MySQL). Same stack
and conventions as **Seed**: Riverpod 3 (codegen), go_router, emulator-first
Firebase. See `SCHEMA.md` for the Firestore contract and the PRD for the
architecture rationale (no API layer: security rules + direct SDK reads).

**Status: emulator-only.** No real Firebase project yet — everything runs
against the local emulator suite under project id `demo-cal-caliente`.
When ready to ship: create the Firebase project, `flutterfire configure`,
swap `lib/firebase_options.dart`, add Google sign-in (+ Apple for iOS).

## Dev loop

```bash
flutter pub get && npm install          # once
cd functions && npm install && cd ..    # once

make emulators     # auth + firestore + functions + UI on :4000 (needs Java: conda env `seed`)
make seed          # 14 default sources + admin user (NO events — the scraper is the source)
make run-ios       # or run-android — wired to the emulator via USE_EMULATOR
```

Events come from the real scraper: in the app, Preferences → ⇄ (debug admin
sign-in) → Admin → **Scrape now**. The RSS/iCal sources (Club Salud, Meetup)
fetch live feeds; the HTML sources (SalsaVida etc.) need `GEMINI_API_KEY` in
the functions environment or they skip. `make seed-demo` adds the hand-written
demo events — test fixtures for the integration tests only (`make purge-demo`
removes them).

Tests:

```bash
make test                       # Dart unit tests
make test-rules                 # 41 Firestore rules tests (jest + rules-unit-testing)
cd functions && npm test        # functions unit tests
make itest DEVICE=<device-id>   # end-to-end smoke (seed with `make seed-demo` first)
```

## Layout

- `lib/features/{events,map,preferences,sources,submit}` — feature-first (Seed style)
- `functions/` — callables (`submitEvent`, `registerSource`, `scrapeNow`) + daily
  `scrapeSources` (RSS/iCal + HTML→Gemini; set `GEMINI_API_KEY` or HTML sources skip)
- `firestore.rules` / `SCHEMA.md` — the authorization layer *is* the API layer
- `scripts/seed/seed_emulator.js` — idempotent emulator seeding
