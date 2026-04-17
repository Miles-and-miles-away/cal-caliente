# Architecture

**Last Updated:** 2026-04-17

---

## System Overview

The application follows a **client-server architecture** with a clear separation between the mobile frontend and the backend API. The backend serves dual roles: it provides a tRPC API for the frontend and runs an automated event scraping engine on an hourly schedule.

```
┌─────────────────────────────────────────────────────┐
│                   Mobile App (Expo)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌───────────┐  │
│  │ Calendar  │ │ Discover │ │ Map  │ │ Settings  │  │
│  └────┬─────┘ └────┬─────┘ └──┬───┘ └─────┬─────┘  │
│       └────────────┬──────────┘            │        │
│              tRPC Client (React Query)              │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/JSON
┌────────────────────┴────────────────────────────────┐
│                Backend (Express + tRPC)              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  API Router   │  │   Scraper    │  │ Scheduler │  │
│  │ (events,     │  │  Engine      │  │ (hourly)  │  │
│  │  sources,    │  │ (adapters)   │  │           │  │
│  │  prefs)      │  │              │  │           │  │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
│         └────────────┬────┘                │        │
│              Drizzle ORM                   │        │
└────────────────────┬───────────────────────┘────────┘
                     │ SQL
              ┌──────┴──────┐
              │   MySQL DB  │
              │  (TiDB)     │
              └─────────────┘
```

---

## Data Flow

### Event Discovery Flow

The scraper engine runs on a configurable interval (default: 1 hour). Each cycle follows this sequence:

1. **Scheduler** triggers `runAllScrapers()`.
2. The runner fetches all active sources from the `event_sources` table.
3. For each source, the appropriate **adapter** is selected based on `sourceType`.
4. The adapter fetches content from the source URL with a strict timeout.
5. Scraped events are upserted into the `events` table (deduplication by `sourceId` + `externalId`).
6. A `scrape_logs` entry is created for each source with status, counts, and duration.

### User Request Flow

1. The mobile app sends a tRPC query (e.g., `events.list`) via React Query.
2. The Express server routes the request through tRPC middleware.
3. Input is validated against a Zod schema.
4. The query function in `server/db.ts` builds a Drizzle ORM query with filters.
5. Results are returned as JSON through the tRPC response pipeline.

---

## Database Schema

The database consists of five tables:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts (OAuth) | `openId`, `name`, `email`, `role` |
| `events` | Dance events | `title`, `danceStyle`, `startAt`, `city`, `latitude`, `longitude` |
| `event_sources` | Scraper sources | `name`, `url`, `sourceType`, `isActive`, `isUserAdded` |
| `scrape_logs` | Scraping audit trail | `sourceId`, `status`, `eventsFound`, `eventsAdded` |
| `user_preferences` | Per-user settings | `city`, `maxDistanceKm`, `danceStyleFilter`, `notificationsEnabled` |

### Relationships

The `events.sourceId` column references `event_sources.id`, establishing which source discovered each event. The `scrape_logs.sourceId` column similarly references `event_sources.id` for audit purposes. The `user_preferences.userId` references `users.id` with a unique constraint ensuring one preference record per user.

---

## Module Structure

| Directory | Contents |
|-----------|----------|
| `app/(tabs)/` | Tab screens: Calendar, Discover, Map, Preferences |
| `app/event/` | Event detail screen (dynamic route `[id]`) |
| `app/sites.tsx` | Event source management screen |
| `components/` | Reusable UI components (EventCard, FilterChips, ScreenContainer) |
| `shared/` | Constants, types, and formatting helpers shared between frontend and backend |
| `server/` | Express server, tRPC routers, database queries, scraper engine |
| `server/_core/` | Server infrastructure (startup, OAuth, context, environment) |
| `drizzle/` | Database schema definitions |
| `docs/` | Project documentation |
| `tests/` | Unit test files |

---

## Design Decisions

**Why tRPC over REST?** tRPC provides end-to-end type safety between the backend and frontend, eliminating the need for manual API type definitions and reducing the risk of contract mismatches.

**Why Drizzle ORM?** Drizzle provides a lightweight, type-safe query builder that maps directly to SQL without the overhead of a full ORM. It integrates well with the MySQL/TiDB database and supports raw SQL when needed.

**Why adapter pattern for scrapers?** Each event source type (Facebook, Instagram, HTML, RSS) requires different parsing logic. The adapter pattern allows adding new source types without modifying the core scraping engine.

**Why AsyncStorage for preferences?** User preferences are stored locally on the device for immediate access without network latency. The backend `user_preferences` table exists for future cross-device sync when user authentication is fully implemented.
