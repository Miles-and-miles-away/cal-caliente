# API Reference

**Last Updated:** 2026-04-17
**Base URL:** `http://127.0.0.1:3000/api/trpc`

---

## Overview

The backend exposes a **tRPC** API with three router groups: `events`, `sources`, and `preferences`. All endpoints use JSON encoding over HTTP GET (queries) or POST (mutations). Input validation is enforced via Zod schemas on every endpoint.

---

## Health Check

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/health` | `{ "ok": true, "timestamp": 1713348000000 }` |

---

## Events Router (`events.*`)

### `events.list` — Query

Fetches a paginated, filtered list of events.

**Input Schema:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `danceStyle` | `string` | No | — | Filter by dance style (`salsa`, `bachata`, `both`, `other`) |
| `eventType` | `string` | No | — | Filter by event type (`social`, `workshop`, `festival`, `class`, `performance`, `other`) |
| `city` | `string` | No | — | Filter by city name |
| `prefecture` | `string` | No | — | Filter by prefecture |
| `startDate` | `string` (ISO) | No | — | Events starting on or after this date |
| `endDate` | `string` (ISO) | No | — | Events starting on or before this date |
| `search` | `string` | No | — | Full-text search across title, venue, organizer, city |
| `limit` | `number` | No | 50 | Max results (1–500) |
| `offset` | `number` | No | 0 | Pagination offset |

**Response:** Array of event objects ordered by `startAt` ascending.

---

### `events.getById` — Query

Fetches a single event by ID.

**Input Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `number` | Yes | Event ID (positive integer) |

**Response:** Single event object or `null`.

---

## Sources Router (`sources.*`)

### `sources.list` — Query

Fetches all event sources.

**Input Schema:** None.

**Response:** Array of source objects ordered by `createdAt` descending.

---

### `sources.add` — Mutation

Registers a new user-added event source.

**Input Schema:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | `string` | Yes | 1–255 chars, trimmed | Display name for the source |
| `url` | `string` | Yes | Valid URL, max 2048 chars | Source URL to scrape |
| `sourceType` | `enum` | Yes | `html`, `facebook`, `instagram`, `rss` | Type of scraper adapter to use |

**Security:** URL is validated for protocol (`http://` or `https://` only), length, and format. The source is marked as `isUserAdded: true`.

**Response:** The created source object.

---

### `sources.toggleActive` — Mutation

Toggles the `isActive` flag on a source.

**Input Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `number` | Yes | Source ID |
| `isActive` | `boolean` | Yes | New active state |

---

### `sources.delete` — Mutation

Deletes a user-added source. System-seeded sources cannot be deleted.

**Input Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `number` | Yes | Source ID (must be user-added) |

---

### `sources.triggerScrape` — Mutation

Manually triggers a scrape cycle for a specific source.

**Input Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `number` | Yes | Source ID |

**Response:** `{ eventsFound: number, eventsAdded: number }`.

---

## Preferences Router (`preferences.*`)

### `preferences.get` — Query

Fetches preferences for the authenticated user.

**Input Schema:** None (uses session user ID).

**Response:** User preferences object or `null`.

---

### `preferences.upsert` — Mutation

Creates or updates preferences for the authenticated user.

**Input Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `city` | `string` | No | Preferred city |
| `maxDistanceKm` | `number` | No | Max distance from station (km) |
| `danceStyleFilter` | `string` | No | JSON array of preferred styles |
| `notificationsEnabled` | `boolean` | No | Enable push notifications |
| `eventTypeFilter` | `string` | No | JSON array of preferred event types |

---

## Error Handling

All endpoints return standard tRPC error responses:

| Code | Meaning |
|------|---------|
| `BAD_REQUEST` | Invalid input (Zod validation failed) |
| `NOT_FOUND` | Resource does not exist |
| `INTERNAL_SERVER_ERROR` | Unexpected server error |
| `UNAUTHORIZED` | Authentication required (for protected routes) |

Error responses include a `message` field with a human-readable description. In development, stack traces may be included; in production, they are stripped.
