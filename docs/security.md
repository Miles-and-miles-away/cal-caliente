# Security Practices

**Last Updated:** 2026-04-17

---

## Overview

This document describes the security measures implemented in the Salsa & Bachata Japan application. The app handles user-submitted URLs, external web content, and database queries, making input validation and sanitization critical.

---

## Input Validation

All API inputs are validated using **Zod schemas** before any processing occurs. The tRPC framework automatically rejects requests that fail schema validation with a `BAD_REQUEST` error.

| Validation Rule | Applied To | Implementation |
|----------------|------------|----------------|
| String length limits | Source names (255), URLs (2048) | Zod `.max()` |
| URL protocol whitelist | Source URLs | `ALLOWED_URL_PROTOCOLS` constant (`http:`, `https:`) |
| Positive integer check | Event IDs, Source IDs | Zod `.positive()` |
| Pagination bounds | `limit` (1–500), `offset` (>= 0) | Zod `.min()` / `.max()` |
| Enum validation | `danceStyle`, `eventType`, `sourceType` | Zod `.enum()` |
| ISO date format | `startDate`, `endDate` | Zod `.string()` + `new Date()` parsing |

---

## SQL Injection Prevention

The application uses **Drizzle ORM** with parameterized queries for all database operations. No raw string concatenation is used in SQL construction.

For `LIKE` queries (full-text search), the `escapeLikePattern()` function sanitizes user input by escaping the special characters `%`, `_`, and `\` before they are interpolated into the pattern. This prevents users from injecting wildcard patterns into search queries.

```typescript
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, (char) => `\\${char}`);
}
```

---

## URL Sanitization

User-submitted URLs (for event sources) undergo multi-layer validation:

1. **Protocol check:** Only `http:` and `https:` protocols are allowed. This prevents `javascript:`, `data:`, `file:`, and other dangerous URI schemes.
2. **Length check:** URLs exceeding 2,048 characters are rejected.
3. **Parse validation:** The URL must be parseable by the `URL` constructor.
4. **Fragment removal:** Hash fragments are stripped from URLs before storage.
5. **Fetch timeout:** All HTTP requests from the scraper have a strict 15-second timeout to prevent slowloris-style resource exhaustion.

---

## Content Safety

| Measure | Description |
|---------|-------------|
| HTML truncation | Scraped HTML is truncated to 30,000 characters before processing |
| User-agent identification | The scraper identifies itself with a clear `User-Agent` header |
| Error message truncation | Scraper error messages are capped at 500 characters in the database |
| JSON body limit | Express body parser is limited to 1 MB to prevent payload attacks |

---

## Authentication & Authorization

The app uses OAuth-based authentication via the server's built-in auth system. Protected routes require a valid session.

| Route Type | Auth Required | Notes |
|------------|---------------|-------|
| `events.list` | No | Public read access to events |
| `events.getById` | No | Public read access |
| `sources.list` | No | Public read access to sources |
| `sources.add` | No (recommended: Yes) | Should be protected in production |
| `sources.delete` | No (recommended: Yes) | Only user-added sources can be deleted |
| `preferences.get` | Yes | Requires authenticated user |
| `preferences.upsert` | Yes | Requires authenticated user |

---

## Environment Variables

Sensitive configuration is managed through environment variables, never hardcoded:

| Variable | Purpose | Exposed to Frontend? |
|----------|---------|---------------------|
| `DATABASE_URL` | MySQL connection string | No |
| `FACEBOOK_GRAPH_API_TOKEN` | Facebook API access | No |
| `INSTAGRAM_GRAPH_API_TOKEN` | Instagram API access | No |
| `GOOGLE_MAPS_API_KEY` | Maps geocoding (future) | No |
| `SESSION_SECRET` | OAuth session signing | No |

---

## CORS Policy

The API enforces a CORS **allowlist** — not origin reflection. The middleware lives in `server/_core/cors.ts` and accepts only:

- `http(s)://localhost` and `http(s)://127.0.0.1` on any port (local dev)
- The Manus sandbox/preview pattern: `https://<port>-<id>.<region>.manuspre.computer`
- Any explicit origins listed in the `ALLOWED_ORIGINS` env var (comma-separated, exact match)

Native iOS/Android requests do not send an `Origin` header and are unaffected — CORS only governs browser callers (Expo web, future web build).

### Why allowlist, not reflection

Origin reflection (`Access-Control-Allow-Origin: <req.origin>`) combined with `Access-Control-Allow-Credentials: true` lets *any* website make authenticated cross-origin requests against the API. That is a CSRF vector against `auth.logout` today and against every authenticated mutation we ship in the future. Allowlisting closes this hole at the cost of one config update per new origin.

### Adding a new origin

1. If it matches a stable pattern (a new dev host family, a sandbox-style preview), add a regex to `DEV_ORIGIN_PATTERNS` in `server/_core/cors.ts`.
2. For production / single-domain deployments, set `ALLOWED_ORIGINS=https://your-domain.com` in the server environment.

**Do not** "fix" a CORS error by reverting the middleware to reflect `req.headers.origin`. The regression test in `tests/cors.test.ts` will catch that.

---

## Production Recommendations

The following security measures are recommended for production deployment but are not yet implemented:

1. **Rate limiting** — Add rate limits on mutation endpoints (source add, scrape trigger) to prevent abuse.
2. **CSP headers** — Add Content Security Policy headers to prevent XSS in the web version.
3. **HTTPS enforcement** — Ensure all traffic uses TLS in production.
4. **Source moderation** — Add admin approval workflow for user-submitted sources before they are scraped.
5. **Audit logging** — Log all mutation operations with user identity and timestamp.
