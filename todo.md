# Cal🔥Caliente — Project TODO

## Core Features (Completed)
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
- [x] 14+ dance styles with color-coded filters
- [x] 1-month event history lookback
- [x] Favorites/save system with "All Events" / "My Calendar" toggle
- [x] Resilience framework: offline support, error boundaries, caching
- [x] Cal🔥Caliente branding with custom fire costume logo

## User Authentication & Authorization
- [ ] Set up Gmail OAuth integration (expo-auth-session)
- [ ] Add user table to database schema (id, email, name, avatar, created_at, is_admin)
- [ ] Create login/signup screens
- [ ] Add user context provider for global auth state
- [ ] Implement protected routes (redirect to login if not authenticated)
- [ ] Add logout functionality to Settings screen
- [ ] Store auth token securely in device keychain (expo-secure-store)
- [ ] Add user profile screen (name, email, avatar, preferences)
- [ ] Implement "Remember me" functionality for faster re-login

## User-Generated Events & Sharing
- [ ] Add user_events table to schema (id, user_id, title, description, date, time, location, lat, lng, dance_style, image_url, is_shared, created_at, updated_at)
- [ ] Create event submission form screen with photo upload
- [ ] Add "Share with Community" toggle on submission form
- [ ] Display user-generated events in Discover tab with "Community Events" filter
- [ ] Allow users to edit their own submissions
- [ ] Allow users to delete their own submissions
- [ ] Show event creator name and avatar on event cards
- [ ] Add "Report Event" button for inappropriate content

## Automatic Content Moderation
- [ ] Implement profanity filter (block rude/offensive words in titles/descriptions)
- [ ] Add word filter list to server constants
- [ ] Flag events with inappropriate language (hide by default, show warning)
- [ ] Log flagged events for admin review
- [ ] Create moderation status field in user_events table (pending, approved, hidden)
- [ ] Auto-approve events that pass moderation checks

## User Management & Blocking
- [ ] Add user_blocks table (blocker_id, blocked_user_id, created_at)
- [ ] Add "Hide events from this user" button on event cards
- [ ] Filter out hidden user's events from all screens
- [ ] Show blocked users list in Settings
- [ ] Allow users to unblock users
- [ ] Prevent blocked users from seeing your shared events

## Event Attendance Tracking
- [ ] Add user_event_attendance table (user_id, event_id, status: 'interested'/'attending'/'not_attending', created_at)
- [ ] Add "Interested" / "Attending" buttons on event cards
- [ ] Show attendance count on event cards
- [ ] Sort event lists by attendance count (most popular first)
- [ ] Add "Events I'm Attending" filter in Calendar
- [ ] Show attendance status on event detail screen
- [ ] Display attendee avatars on event cards (top 3)

## Admin Dashboard & User Management
- [ ] Create admin login (email-based, hardcoded admin emails in env var)
- [ ] Build admin dashboard screen (protected route)
- [ ] Show user statistics (total users, events created, flagged events)
- [ ] Display list of flagged/inappropriate events
- [ ] Add approve/hide/delete buttons for flagged events
- [ ] Show user list with creation date and event count
- [ ] Add user suspension/ban functionality
- [ ] View user's submitted events and attendance history
- [ ] Export user data for analytics

## UI/UX Improvements
- [ ] Add pull-to-refresh to Calendar screen (RefreshControl)
- [ ] Add pull-to-refresh to Discover screen (RefreshControl)
- [ ] Add pull-to-refresh to Map screen (RefreshControl)
- [ ] Show loading spinner while refreshing
- [ ] Add "Last updated" timestamp to screens
- [ ] Show user avatar in top-right corner when logged in
- [ ] Add notification badge for new events matching preferences
- [ ] Improve event card layout to show attendance count and user avatar

## Database Schema Updates
- [ ] Add users table (id, email, name, avatar_url, created_at, is_admin)
- [ ] Add user_events table (id, user_id, title, description, date, time, location, lat, lng, dance_style, image_url, is_shared, moderation_status, created_at, updated_at)
- [ ] Add user_event_attendance table (user_id, event_id, status, created_at)
- [ ] Add user_blocks table (blocker_id, blocked_user_id, created_at)
- [ ] Add moderation_logs table (id, event_id, reason, flagged_at, resolved_at, admin_action)
- [ ] Create indexes on user_id, event_id, created_at for performance

## API Routes (New/Updated)
- [ ] POST /auth/login (Gmail OAuth callback)
- [ ] POST /auth/logout
- [ ] GET /auth/me (get current user)
- [ ] POST /user/events (create user event)
- [ ] GET /user/events (list user's events)
- [ ] PATCH /user/events/:id (update user event)
- [ ] DELETE /user/events/:id (delete user event)
- [ ] POST /user/attendance (mark attendance)
- [ ] GET /user/attendance (get user's attendance)
- [ ] POST /user/blocks (block user)
- [ ] DELETE /user/blocks/:id (unblock user)
- [ ] GET /admin/users (list all users - admin only)
- [ ] GET /admin/events (list flagged events - admin only)
- [ ] PATCH /admin/events/:id (approve/hide event - admin only)
- [ ] POST /admin/users/:id/suspend (suspend user - admin only)

## Testing
- [ ] Write tests for user authentication flow
- [ ] Write tests for event submission and moderation
- [ ] Write tests for attendance tracking
- [ ] Write tests for user blocking
- [ ] Write tests for admin endpoints
- [ ] Test profanity filter with various inputs
- [ ] Run full test suite after each feature

## Documentation Updates
- [ ] Update docs/README.md with user auth flow
- [ ] Update docs/architecture.md with new database schema
- [ ] Update docs/api.md with new API routes
- [ ] Create docs/user-events.md for event submission guide
- [ ] Create docs/admin-guide.md for admin dashboard usage
- [ ] Update docs/security.md with user data privacy policies
- [ ] Document moderation policies and content guidelines

## Deployment & Configuration
- [ ] Add GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET env vars
- [ ] Add ADMIN_EMAILS env var (comma-separated list)
- [ ] Add PROFANITY_FILTER_WORDS env var or load from file
- [ ] Update deployment guide with new env vars
- [ ] Test Gmail OAuth in production environment

## Final Delivery
- [ ] Run all 122+ tests (ensure no regressions)
- [ ] Verify offline functionality with new features
- [ ] Test user auth flow end-to-end
- [ ] Test event submission and moderation
- [ ] Test admin dashboard
- [ ] Update all documentation
- [ ] Save final checkpoint
- [ ] Prepare delivery summary

## PRIORITY ORDER: 5→6→1→2→4→3

## Phase 1: Pull-to-Refresh (COMPLETED)
- [x] Add RefreshControl to Calendar screen
- [x] Add RefreshControl to Discover screen
- [x] Add RefreshControl to Map screen
- [x] Implement refresh handler that re-fetches events from API
- [x] Show loading state during refresh
- [x] Fix infinite loading bug in Discover screen
- [x] Fix missing refresh UI in Calendar screen
- [x] Add FlatList props for pull-to-refresh visibility (alwaysBounceVertical, bounces, progressViewOffset)
- [x] Write comprehensive pull-to-refresh tests (28 tests)
- [x] Verify all tests pass (149 passing)

## Phase 2: Admin Dashboard
- [ ] Create admin routes and screens (protected by is_admin flag)
- [ ] Build admin home screen with stats (total users, events, flagged content)
- [ ] Create user management screen (view all users, block/suspend)
- [ ] Create moderation dashboard (view flagged events, approve/hide/delete)
- [ ] Add admin-only Settings tab or navigation
- [ ] Implement admin auth check in backend routers

## Phase 3: Gmail OAuth Authentication
- [ ] Set up Gmail OAuth configuration
- [ ] Create login screen with "Sign in with Google" button
- [ ] Implement Gmail OAuth flow using expo-auth-session
- [ ] Store auth token securely in device keychain
- [ ] Create user context provider for global auth state
- [ ] Add logout functionality
- [ ] Implement protected routes (redirect to login if not authenticated)
- [ ] Create user profile screen

## Phase 4: Event Submission & Sharing
- [ ] Create event submission form screen
- [ ] Add photo upload functionality
- [ ] Implement "Share with Community" toggle
- [ ] Create user-generated events tab in Discover
- [ ] Allow users to edit their own events
- [ ] Allow users to delete their own events
- [ ] Show event creator info on event cards

## Phase 5: Attendance Tracking
- [ ] Add "Interested" button to event cards
- [ ] Add "Attending" button to event cards
- [ ] Add "Not Attending" button to event cards
- [ ] Store attendance status in database
- [ ] Sort event lists by attendance count (most attended first)
- [ ] Show attendance count on event cards
- [ ] Create "My Attending" filter in Discover

## Phase 6: Moderation System
- [ ] Integrate profanity filter into event submission
- [ ] Auto-flag events with inappropriate language
- [ ] Create moderation status field (pending/approved/hidden)
- [ ] Add hide toggle for events from blocked users
- [ ] Implement user block feature
- [ ] Log all moderation actions
- [ ] Run full test suite (122+ tests)
- [ ] Save checkpoint and deliver



## Phase 1.5: Mapping Improvements (Nominatim + OpenStreetMap)
- [x] Add city coordinates constant for all major Japan cities
- [x] Implement Nominatim geocoding utility (address → lat/lng) in lib/geocoding.ts
- [x] Update map screen to jump to selected city when filter changes
- [x] Replace hardcoded Tokyo center with dynamic city selection
- [x] Add Nominatim caching to avoid repeated geocoding
- [ ] Test map centering on city selection
