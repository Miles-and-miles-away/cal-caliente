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
