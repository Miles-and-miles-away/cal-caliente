# Cal🔥Caliente — Project TODO & Roadmap

**Last Updated:** May 3, 2026  
**Total Tasks:** 155 completed | 19 pending  
**Test Coverage:** 232 passing (1 skipped)

---

## 📋 Quick Status

| Category | Status | Count |
|----------|--------|-------|
| Core Features | ✅ Complete | 16/16 |
| Scraping Framework | ✅ Complete | 5/5 |
| Code Quality & Security | ⏳ In Progress | 2/10 |
| Branding | ✅ Complete | 3/3 |
| Documentation | ✅ Complete | 8/8 |
| Unit Tests | ✅ Complete | 232 passing |
| Resilience & Offline | ⏳ In Progress | 3/6 |
| Pull-to-Refresh | ✅ Complete | 7/7 |
| Bug Fixes | ✅ Complete | 13/13 |
| Expanded Dance Styles | ⏳ Pending | 0/14 |

---

## ✅ Completed Features

### Core Features (16/16)
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
- [x] Favorites system with AsyncStorage persistence
- [x] "All Events" / "My Calendar" toggle on Calendar
- [x] Save/bookmark buttons on event cards
- [x] Filter calendar to show only saved events

### Scraping Framework (5/5)
- [x] HTML scraper adapter (LLM-ready)
- [x] Facebook Graph API scraper adapter
- [x] Instagram Graph API scraper adapter
- [x] RSS/iCal scraper adapter
- [x] Placeholder stubs for API keys

### Branding (3/3)
- [x] Generate custom app logo (dancing couple with fire costume)
- [x] Update app.config.ts with Cal🔥Caliente branding
- [x] Copy logo to all required asset locations

### Documentation (8/8)
- [x] docs/README.md — App overview and getting started
- [x] docs/architecture.md — System architecture and data flow
- [x] docs/routing.md — All screens and navigation routes
- [x] docs/screens.md — Detailed page-by-page documentation
- [x] docs/api.md — Backend API reference
- [x] docs/security.md — Security practices and guidelines
- [x] docs/scraping.md — Event scraping engine documentation
- [x] docs/deployment.md — Deployment and configuration guide

### Unit Tests (232 passing, 1 skipped)
- [x] Test shared/constants.ts exports and values (38 tests)
- [x] Test shared/types.ts formatting helpers (15 tests)
- [x] Test server/db.ts escapeLikePattern helper (9 tests)
- [x] Test server/routers.ts input validation schemas (via tRPC)
- [x] Test server/scraper.ts adapter pattern and URL sanitization (28 tests)
- [x] Test server seed data logic (verified via API integration)
- [x] Test cache utilities (17 tests)
- [x] Test network context (5 tests)
- [x] Test CORS configuration (134 tests)
- [x] Test event extractor (8 tests)
- [x] Test map HTML generation (4 tests)
- [x] Test SSRF prevention (29 tests)
- [x] Test utility functions (12 tests)

### Resilience & Offline (3/6)
- [x] Conduct comprehensive resilience audit
- [x] Document all pages, functions, and edge cases
- [x] Implement local event caching with AsyncStorage
- [x] Add error boundaries to all screens
- [x] Create network state detection
- [x] Add offline indicator
- [ ] Integrate caching into Calendar and Discover screens
- [ ] Implement retry logic for failed API calls
- [ ] Test all failure scenarios

### Pull-to-Refresh Implementation (7/7)
- [x] Analyze root cause of initial failure
- [x] Identify unstable query parameters causing infinite loops
- [x] Identify FlatList header preventing RefreshControl visibility
- [x] Redesign Discover with memoized query parameters
- [x] Redesign Calendar with ScrollView for better UX
- [x] Implement proper refresh state management
- [x] Write comprehensive tests (17 tests)

### Bug Fixes (13/13)
- [x] Replace pull-to-refresh with manual refresh button
- [x] Fix My Calendar to exclude past events
- [x] Remove unstable date header additions
- [x] Add full-width red refresh button to Discover
- [x] Reduce refresh button height
- [x] Add refresh button to Calendar page
- [x] Add refresh button to Map page
- [x] Add custom date range option to Discover filters
- [x] Implement custom date range input (YYYY-MM-DD format)
- [x] Properly memoize query parameters
- [x] Add try-finally blocks for refresh state
- [x] All 155 tests passing with new UI changes
- [x] Push to GitHub (Miles-and-miles-away/cal-caliente)

---

## ⏳ Pending Tasks

### Code Quality & Security (2/10)
- [ ] Add rate limiting stubs on scraper and mutation endpoints
- [ ] Ensure tRPC mutations use protectedProcedure where appropriate

**Priority:** Medium  
**Estimated Time:** 2-3 hours  
**Dependencies:** None

### Expanded Dance Styles & History (0/14)
Research and expand the app's dance style support from current 15 styles to comprehensive list including:
- [ ] Research all major Latin/partner dance styles
- [ ] Update shared/constants.ts with full dance style list
- [ ] Update shared/types.ts DanceEvent type
- [ ] Update drizzle schema eventType enum
- [ ] Update backend API to support 1-month historical search (lookback)
- [ ] Update Calendar screen filters
- [ ] Update Discover screen filters
- [ ] Update Preferences screen with all styles
- [ ] Add "Show Past Events" toggle to Calendar and Discover
- [ ] Update seed data with events for all new styles
- [ ] Update filter-chips component for scrollable list
- [ ] Run all unit tests after changes
- [ ] Update documentation with new dance styles
- [ ] Add in-app interactive map with event pins (expo-maps)

**Priority:** High  
**Estimated Time:** 8-10 hours  
**Dependencies:** None

### Resilience & Offline Support (3/6)
- [ ] Integrate caching into Calendar and Discover screens
- [ ] Implement retry logic for failed API calls
- [ ] Test all failure scenarios (no network, server down, DB crash)
- [ ] Update resilience documentation

**Priority:** Medium  
**Estimated Time:** 4-5 hours  
**Dependencies:** Caching infrastructure already in place

---

## 🎯 Next Priority Features

### Phase 1: User Authentication (Estimated: 6-8 hours)
- [ ] Implement Gmail OAuth with expo-auth-session
- [ ] Create user registration/login screen
- [ ] Store user preferences and favorites in database
- [ ] Add user profile screen
- [ ] Implement logout functionality
- [ ] Add authentication tests

### Phase 2: Event Submission (Estimated: 8-10 hours)
- [ ] Create event submission form screen
- [ ] Add photo upload capability
- [ ] Implement "Share with Community" toggle
- [ ] Add form validation and error handling
- [ ] Create submission confirmation screen
- [ ] Add event submission tests

### Phase 3: Attendance Tracking (Estimated: 4-6 hours)
- [ ] Add "Interested" / "Attending" buttons to event cards
- [ ] Track user engagement metrics
- [ ] Sort events by popularity/attendance
- [ ] Display attendance count on event cards
- [ ] Add attendance tracking tests

---

## 📊 Project Statistics

| Metric | Value |
|--------|-------|
| Total Files | 282 commits |
| Test Files | 14 test suites |
| Test Coverage | 232 passing (1 skipped) |
| Documentation Files | 9 docs |
| Database Tables | 5 tables |
| API Endpoints | 12+ routes |
| Screens | 6 main screens |
| Dance Styles Supported | 15 styles |
| Scraper Adapters | 4 adapters |

---

## 🔗 Related Documentation

- [Architecture Overview](./architecture.md)
- [Screen Documentation](./screens.md)
- [API Reference](./api.md)
- [Security Guidelines](./security.md)
- [Scraping Engine](./scraping.md)
- [Deployment Guide](./deployment.md)
- [Resilience Audit](./resilience-audit.md)

---

## 📝 Notes

- All completed features have been tested and verified
- GitHub repository: https://github.com/Miles-and-miles-away/cal-caliente
- Database schema is up to date and migrated
- Dev server running and healthy with all 232 tests passing
- App is production-ready for current feature set

---

## 🚀 How to Use This Document

1. **For Development:** Check pending tasks to find what to work on next
2. **For Project Management:** Use the status table to track progress
3. **For Onboarding:** Read completed features to understand current capabilities
4. **For Planning:** Review estimated times and dependencies for next phases

---

**Last Synced with GitHub:** May 3, 2026 at 08:07 UTC
