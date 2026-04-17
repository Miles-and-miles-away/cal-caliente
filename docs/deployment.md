# Deployment & Configuration

**Last Updated:** 2026-04-17

---

## Overview

The application consists of two deployable components: the **Expo mobile app** (built as APK/IPA or served via Expo Go) and the **Node.js backend server** (Express + tRPC). Both must be running for the app to function.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | MySQL/TiDB connection string |
| `PORT` | No | `3000` | Backend server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `FACEBOOK_GRAPH_API_TOKEN` | No | — | Facebook Graph API access token for scraping |
| `INSTAGRAM_GRAPH_API_TOKEN` | No | — | Instagram Graph API access token for scraping |
| `GOOGLE_MAPS_API_KEY` | No | — | Google Maps API key for geocoding (future) |

---

## Development Setup

The development environment runs both the Metro bundler and the API server concurrently:

```bash
pnpm dev
```

This executes two processes:
- `dev:metro` — Expo Metro bundler on port 8081
- `dev:server` — Express API server on port 3000 (with hot reload via `tsx watch`)

---

## Database Setup

The app uses MySQL (TiDB) with Drizzle ORM. To apply schema changes:

```bash
pnpm db:push
```

This generates migration files and applies them to the database. On first server startup, the `seedDatabase()` function automatically populates demo data if the `events` table is empty.

---

## Building for Production

### Mobile App (APK/IPA)

The recommended approach is to use the Manus platform's **Publish** button, which triggers the Expo build pipeline and generates the APK. Do not attempt to build the APK directly in the sandbox, as this will cause resource exhaustion.

### Backend Server

```bash
pnpm build    # Bundles server to dist/index.js via esbuild
pnpm start    # Runs the production server
```

---

## Configuration Constants

Key application constants are defined in `shared/constants.ts` and shared between frontend and backend:

| Constant | Value | Purpose |
|----------|-------|---------|
| `APP_NAME` | `"Salsa & Bachata Japan"` | Display name |
| `APP_VERSION` | `"1.0.0"` | App version |
| `DEFAULT_REGION` | `"japan"` | Default scraping region |
| `API_DEFAULT_PAGE_SIZE` | `50` | Default pagination limit |
| `API_MAX_PAGE_SIZE` | `500` | Maximum pagination limit |
| `API_EVENT_LOOKAHEAD_DAYS` | `60` | Default event lookahead window |
| `SCRAPER_INTERVAL_MS` | `3,600,000` | Scraper cycle interval (1 hour) |

---

## Expanding to New Regions

The app is designed for Japan but can be expanded to other regions:

1. Add new city options to `JAPAN_CITIES` in `shared/constants.ts` (or create a region-specific constant).
2. Add new seed sources for the target region in `server/_core/index.ts`.
3. Update the `region` field on new sources to the target region identifier.
4. Add region-based filtering to the API if needed.
5. Update the app name and branding as appropriate.

---

## Monitoring

The server provides basic monitoring through console logging:

| Log Prefix | Source | Information |
|------------|--------|-------------|
| `[Seed]` | Startup | Database seeding status |
| `[Scraper]` | Scheduler | Scrape cycle start/end, event counts |
| `[Scraper:HTML]` | HTML adapter | Fetch results, errors |
| `[Scraper:Facebook]` | FB adapter | API status, token availability |
| `[Scraper:Instagram]` | IG adapter | API status, token availability |
| `[Scraper:RSS]` | RSS adapter | Fetch results, errors |
| `[api]` | Server | Port binding, startup confirmation |

The `scrape_logs` database table provides a persistent audit trail of all scraping activity, queryable for debugging and performance analysis.
