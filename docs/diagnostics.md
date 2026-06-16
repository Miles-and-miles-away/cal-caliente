# Diagnostics

## `scripts/diagnose.mjs` — "the app shows no events"

A one-shot, full-stack diagnostic for the most common production confusion: the
database has events but the app displays none. Instead of probing each layer by
hand (and trusting piecemeal observations), it checks **every** layer in a single
run and prints one report. Plain Node — no `tsx`/build step.

### Run it

Run it **on the host where the API server is running** — it queries the database
directly and calls `localhost:3000`:

```bash
npm run diagnose -- https://8081-<id>.<region>.manus.computer
# equivalently: node scripts/diagnose.mjs https://8081-<id>.<region>.manus.computer
```

The argument is the **preview's browser origin** (the URL in the address bar). It's
optional but lets the script test CORS with the real `Origin`; if omitted, it
derives one from `EXPO_PUBLIC_API_BASE_URL` (swapping `3000-` → `8081-`). The script
reads `DATABASE_URL` and `EXPO_PUBLIC_API_BASE_URL` from the environment or `.env`.

### What it reports

| Section | Answers |
|---|---|
| 1. Code / version | Is this the current commit? Is the CORS fix present? (`git` + greps `cors.ts`) |
| 2. Env / config | `EXPO_PUBLIC_API_BASE_URL`, `DATABASE_URL` (masked, no password) |
| 3. Database | event / source counts via a direct query |
| 4. Local API | does `localhost:3000` serve events? + its `Access-Control-Allow-Origin` |
| 5. Public API | the exact URL + `Origin` the browser uses → HTTP status, event count, `Allow-Origin` |
| 6. Served bundle | best-effort: which API host is baked into the web bundle (stale-bundle check) |
| 7. Browser | a console snippet for the one thing a script can't see — whether the query actually fires |

### Reading the result — first wrong layer is the cause

- **§3 shows 0 events** → the DB was never populated. Restart the server (it seeds
  the 14 sources on boot), then `npm run scrape:now`. See the runbook in `TODO.md`.
- **§4 returns 0 / errors** → the API server can't see the DB: wrong `DATABASE_URL`,
  or TiDB needs TLS in the URL (`?ssl={"rejectUnauthorized":true}`).
- **§5 fails to connect** → the public `3000-…` host isn't reachable (port not
  exposed), or `EXPO_PUBLIC_API_BASE_URL` points at a dead/old sandbox id.
- **§5 connects but `Allow-Origin: (none)`** → CORS is blocking the browser origin.
  The server needs the `server/_core/cors.ts` allowlist to cover the origin, then a
  **server restart** (deploying the file isn't enough — the running process must reload).
- **§3–§5 all healthy but the app still shows nothing** → it's the **client**. Run
  the §7 browser snippet in the preview's DevTools console: if a manual `fetch`
  returns events, the app's bundle/query is the problem — rebuild with
  `expo start -c` (clears the Metro cache so `EXPO_PUBLIC_*` re-inlines) and reload.
  Also confirm the served code is current (§1): a stale bundle or old commit shows
  "0 events" with no network activity and ignores new `console.log`s.

### Related scripts

| Command | Purpose |
|---|---|
| `npm run db:reset` | Drop all tables → replay migrations from 0000 → verify schema vs snapshot (see the runbook in `TODO.md`). |
| `npm run scrape:now` | One-shot manual scrape cycle to (re)populate events; needs sources already seeded. |
