# Cal Caliente

[![CI](https://github.com/Miles-and-miles-away/cal-caliente/actions/workflows/ci.yml/badge.svg)](https://github.com/Miles-and-miles-away/cal-caliente/actions/workflows/ci.yml)

Salsa & Bachata event calendar for Japan. Flutter + Firebase: Riverpod 3
(codegen), go_router, emulator-first Firebase, Cloud Functions for scraping.

Events are not hand-entered. A daily Cloud Function pulls RSS and iCal feeds
directly, and runs HTML listing pages through Gemini Flash to extract
structured events, deduplicating across sources on two independent keys.

There is no API layer by design: the clients read Firestore through the SDK and
`firestore.rules` *is* the authorization boundary. `SCHEMA.md` is the contract
that rules, functions, app, and seed script are all kept in sync against.

**Status:** development runs against the local emulator suite under project id
`demo-cal-caliente`. A real `cal-caliente` Firebase project is configured in
`lib/firebase_options.dart`, but nothing is deployed to it yet, and Google/Apple
sign-in is not wired up (auth is anonymous-only).

## Worth a look

If you are reading this as a code sample, these three files carry the most
interesting work:

- [`functions/src/safeFetch.ts`](functions/src/safeFetch.ts): SSRF-guarded
  fetch: redirects are followed manually so every hop is revalidated, private
  and link-local ranges are blocked for both IPv4 and IPv6 (including
  IPv4-mapped forms), and the residual DNS-rebinding window is documented
  rather than hidden.
- [`firestore.rules`](firestore.rules): the authorization layer, with
  field-level allowlists and 50 tests against the emulator.
- [`functions/src/keys.ts`](functions/src/keys.ts): cross-source dedup. Two
  key axes at deliberately different time precisions, Unicode-aware title and
  venue normalization for mixed English/Japanese sources.

## Dev loop

Needs the Flutter SDK, Node 22, and a JDK (the Firestore emulator is a JVM
process; set `JAVA_HOME` if `java` is not already on your path).

```bash
flutter pub get && npm ci        # once
cd functions && npm ci && cd ..  # once

make emulators   # auth + firestore + functions + UI on :4000
make seed        # 14 default sources (no events; the scraper is the source)
make run-ios     # or run-android
```

Events come from the real scraper. In the app: Preferences, the swap button
(debug admin sign-in), then Admin, then **Scrape now**. RSS and iCal sources
fetch live feeds; HTML sources need `GEMINI_API_KEY` in the functions
environment or they skip.

To use the admin panel, seed an admin account and pass the same password to the
app (`make run-ios` and `make itest` forward it):

```bash
SEED_ADMIN_PASSWORD=<pick-one> make seed
SEED_ADMIN_PASSWORD=<same-one> make run-ios
```

`make seed-demo` adds hand-written demo events, which exist as fixtures for the
integration tests only; `make purge-demo` removes them.

## Tests

```bash
make test                       # Dart unit tests
make test-rules                 # 50 Firestore rules tests (jest + rules-unit-testing)
cd functions && npm test        # 57 functions unit tests
make itest DEVICE=<device-id>   # end-to-end smoke (run `make seed-demo` first)
```

CI runs the first three on every push. The integration smoke test needs a
booted device plus a seeded emulator suite, so it stays local.

## Layout

- `lib/features/{events,map,admin,preferences,sources,submit}`: feature-first
- `functions/`: callables (`submitEvent`, `registerSource`, `scrapeNow`,
  `adminDeleteUser`) plus the daily `scrapeSources` job
- `firestore.rules` / `SCHEMA.md`: the authorization layer is the API layer
- `scripts/seed/seed_emulator.js`: idempotent emulator seeding

## History

This repo starts as a React Native + Expo app with an Express/tRPC backend on
MySQL. That version runs through commit `87c5fc0`. Commit `4053301` rebuilds it
on Flutter + Firebase, trading the hand-rolled API layer for security rules and
direct SDK reads. The original data model survives in `SCHEMA.md`, and the
dedup keys in `functions/src/keys.ts` are ported verbatim from the old server so
existing document IDs stay stable.
