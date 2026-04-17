# Salsa & Bachata Japan — Project TODO

## Core Features
- [x] Database schema (events, sources, preferences, scrape_logs)
- [x] Backend API routes (events, sources, preferences, scraper)
- [x] Event scraper engine with adapter pattern
- [x] Hourly scheduler for auto-scraping
- [x] Seed data (demo events + default sources)
- [x] Calendar screen with monthly grid view
- [x] Discover screen with search and filters
- [x] Map screen with location-based event list
- [x] Preferences screen with local storage
- [x] Event detail screen with directions
- [x] Sites management screen (register custom sources)
- [x] Tab navigation (Calendar, Discover, Map, Settings)

## Scraping Framework
- [x] HTML scraper adapter (LLM-ready)
- [x] Facebook Graph API scraper adapter
- [x] Instagram Graph API scraper adapter
- [x] RSS/iCal scraper adapter
- [x] Placeholder stubs for API keys (Option A)

## Code Quality & Security Audit
- [x] Audit all files for consistent naming conventions
- [x] Extract all magic strings/numbers into shared constants
- [x] Add input validation and sanitization on all API endpoints
- [ ] Add rate limiting stubs on scraper and mutation endpoints
- [ ] Ensure tRPC mutations use protectedProcedure where appropriate
- [x] Sanitize user-submitted URLs in source registration
- [x] Add XSS protection for user-generated content display
- [x] Review environment variable handling and secret management
- [x] Ensure no API keys or secrets are exposed to frontend
- [x] Add escapeLikePattern for SQL LIKE injection prevention
- [x] Reduce JSON body limit from 50mb to 1mb
- [x] Replace magic numbers with named constants

## Documentation
- [x] Create docs/README.md — App overview and getting started
- [x] Create docs/architecture.md — System architecture and data flow
- [x] Create docs/routing.md — All screens and navigation routes
- [x] Create docs/screens.md — Detailed page-by-page documentation
- [x] Create docs/api.md — Backend API reference
- [x] Create docs/security.md — Security practices and guidelines
- [x] Create docs/scraping.md — Event scraping engine documentation
- [x] Create docs/deployment.md — Deployment and configuration guide
- [x] Add note: Update documentation after each phase is completed

## Branding
- [x] Generate custom app logo
- [x] Update app.config.ts with branding
- [x] Copy logo to all required asset locations

## Unit Tests
- [x] Test shared/constants.ts exports and values (38 tests passed)
- [x] Test shared/types.ts formatting helpers (15 tests passed)
- [x] Test server/db.ts escapeLikePattern helper (9 tests passed)
- [x] Test server/routers.ts input validation schemas (covered via tRPC integration)
- [x] Test server/scraper.ts adapter pattern and URL sanitization (28 tests passed)
- [x] Test server seed data logic (verified via API integration)
- [x] Run all tests after each phase completion (90 passed, 1 skipped)

## Expanded Dance Styles & History
- [ ] Research and list all major Latin/partner dance styles
- [ ] Update shared/constants.ts with full dance style list
- [ ] Update shared/types.ts DanceEvent type to support new styles
- [ ] Update drizzle schema eventType enum to include new styles
- [ ] Update backend API to support 1-month historical search (lookback)
- [ ] Update Calendar screen filters with expanded dance styles
- [ ] Update Discover screen filters with expanded dance styles
- [ ] Update Preferences screen with all dance style options
- [ ] Add "Show Past Events" toggle to Calendar and Discover
- [ ] Update seed data with events for all new dance styles
- [ ] Update filter-chips component to handle scrollable list of styles
- [ ] Run all unit tests after changes
- [ ] Update documentation with new dance styles
- [ ] Add in-app interactive map with event pins (expo-maps)
- [ ] Fix "Open in Maps" web fallback to use Google Maps URL
- [ ] Create FavoritesContext provider with AsyncStorage persistence
- [ ] Add "All Events" / "My Calendar" toggle on Calendar screen
- [ ] Add save/bookmark button on EventCard component
- [ ] Add save button on Discover screen event cards
- [ ] Add save button on Event Detail screen
- [ ] Filter calendar to show only saved events in "My Calendar" mode


## Resilience & Offline Support
- [x] Conduct comprehensive resilience audit of all pages and functions
- [x] Document all pages, functions, and edge cases (docs/resilience-audit.md)
- [x] Implement local event caching with AsyncStorage (lib/cache.ts)
- [x] Add error boundaries to all screens (components/error-boundary.tsx)
- [x] Create network state detection (lib/network-context.tsx)
- [x] Add offline indicator (components/offline-indicator.tsx)
- [x] Write unit tests for cache utilities (17 tests passed)
- [x] Write unit tests for network context (5 tests passed)
- [ ] Integrate caching into Calendar and Discover screens
- [ ] Implement retry logic for failed API calls
- [ ] Test all failure scenarios (no network, server down, DB crash)
- [ ] Update resilience documentation
