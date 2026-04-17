# Resilience & Offline Support Audit

## Overview

This document provides a comprehensive audit of all pages and functions in the Salsa & Bachata Calendar app, identifying edge cases, failure scenarios, and resilience requirements. The app must gracefully handle network failures, server outages, database crashes, and offline scenarios.

---

## App Pages & Resilience Analysis

### 1. **Calendar Screen** (`app/(tabs)/index.tsx`)

**Purpose:** Display events in a monthly calendar grid with event dots and list view.

**Key Functions:**
- `useQuery("events.list")` — Fetch events for the current month + lookahead
- `filterEvents()` — Filter by dance style, event type, city
- `handleMonthChange()` — Navigate between months
- `toggleMyCalendar()` — Switch between "All Events" and "My Calendar" (favorites)

**Failure Scenarios & Current Handling:**

| Scenario | Current Behavior | Issue | Fix Required |
|---|---|---|---|
| **No network on load** | Query hangs indefinitely | User sees loading spinner forever | Add timeout (15s) + fallback to cached data |
| **Server returns 500** | Query fails silently | No error message shown | Add error boundary + retry button |
| **Database crash** | API returns 500 | Same as above | Same fix |
| **Partial data loss** | Some events missing | User doesn't know | Show "Partial data loaded" badge |
| **User offline mid-scroll** | Can't load more events | Silent failure | Cache events locally, show cached data |
| **Favorites (AsyncStorage) corrupted** | Toggle fails | App might crash | Add try-catch, reset to defaults |
| **Month navigation while offline** | Can only view cached months | Expected behavior | Document this limitation |

**Offline Strategy:**
- Cache events for current month + next 2 months in AsyncStorage
- Show "Offline" indicator when no network
- Allow month navigation through cached data only
- Show "My Calendar" only if favorites are cached

---

### 2. **Discover Screen** (`app/(tabs)/discover.tsx`)

**Purpose:** Search and filter events with advanced options.

**Key Functions:**
- `useQuery("events.list", { search, danceStyle, eventType, city, dateRange })` — Fetch filtered events
- `handleSearch()` — Debounced search input
- `handleFilterChange()` — Update filter state
- `handleDateRangeChange()` — Toggle past_month lookback
- `handleSaveEvent()` — Add to favorites

**Failure Scenarios & Current Handling:**

| Scenario | Current Behavior | Issue | Fix Required |
|---|---|---|---|
| **Search query times out** | Query hangs | User stuck | Add 15s timeout + show "Search failed" |
| **No results found** | Empty list | Unclear if no events or error | Show "No events found" vs "Search failed" clearly |
| **Filter combination returns 0 results** | Empty list | Expected, but needs clarity | Show helpful message: "Try adjusting filters" |
| **Offline + search attempted** | Query fails | User confused | Show "Search unavailable offline" message |
| **Offline + view cached results** | Should work | Need to implement | Cache search results locally |
| **Save to favorites fails** | Silent failure | User doesn't know | Show toast: "Saved" or "Failed to save" |
| **AsyncStorage full** | Save fails | App might crash | Handle gracefully, show "Storage full" |
| **Network restored mid-search** | Should auto-refresh | Not implemented | Add network state listener |

**Offline Strategy:**
- Cache last 50 search results per filter combination
- Show cached results with "Cached data" badge when offline
- Disable search input when offline (or show "Search unavailable")
- Show "Refresh" button when network returns

---

### 3. **Map Screen** (`app/(tabs)/map.tsx`)

**Purpose:** Display events on an interactive map with location-based list.

**Key Functions:**
- `useQuery("events.list", { lookahead: 60 days })` — Fetch all events for map pins
- `handleMapRegionChange()` — Update visible region
- `handleEventPinTap()` — Show event details
- `handleOpenInMaps()` — Launch native Maps app (iOS/Android) or Google Maps (web)

**Failure Scenarios & Current Handling:**

| Scenario | Current Behavior | Issue | Fix Required |
|---|---|---|---|
| **Map library fails to load** | Screen crashes | App unusable | Add error boundary + show list fallback |
| **No network on map load** | Map blank, no pins | Confusing | Show cached pins + "Offline" badge |
| **Geolocation permission denied** | Can't center on user | Expected | Show Tokyo default + explanation |
| **Geolocation times out** | Hangs indefinitely | User stuck | Add 10s timeout, use default location |
| **"Open in Maps" on web** | Opens Google Maps (fallback) | Works but not native | Already handled |
| **"Open in Maps" on iOS/Android** | Opens native app | Works if app installed | Add fallback to web link |
| **Event coordinates invalid (null/0,0)** | Pin shows at 0,0 | Wrong location | Filter out invalid coords, show warning |
| **Offline + can't load event details** | Tap pin, no details | Expected | Show cached event data |

**Offline Strategy:**
- Cache all event pins locally with coordinates
- Show cached pins when offline
- Disable "Open in Maps" when offline (or show web fallback)
- Use default Tokyo region if geolocation fails

---

### 4. **Preferences Screen** (`app/(tabs)/preferences.tsx`)

**Purpose:** Configure user preferences (city, distance, dance styles, notifications).

**Key Functions:**
- `handleCityChange()` — Update preferred city
- `handleDistanceChange()` — Update max distance filter
- `handleDanceStyleToggle()` — Toggle dance style preferences
- `handleEventTypeToggle()` — Toggle event type preferences
- `handleNotificationToggle()` — Enable/disable notifications
- `savePreferences()` — Persist to AsyncStorage + backend

**Failure Scenarios & Current Handling:**

| Scenario | Current Behavior | Issue | Fix Required |
|---|---|---|---|
| **AsyncStorage write fails** | Silent failure | Preferences not saved | Show error toast + retry button |
| **AsyncStorage read fails on load** | Use hardcoded defaults | OK but not ideal | Show warning + use defaults |
| **Backend preferences sync fails** | Offline-only save | Expected | Queue for sync when online |
| **User toggles many styles rapidly** | Multiple writes | Possible race condition | Debounce saves (500ms) |
| **Notification permission denied** | Notifications disabled | Expected | Show explanation |
| **Corrupted AsyncStorage data** | App might crash | Unlikely but possible | Add try-catch, reset to defaults |
| **Offline + try to sync** | Can't reach backend | Expected | Show "Changes saved locally" |

**Offline Strategy:**
- All changes saved to AsyncStorage immediately
- Show "Syncing..." indicator when online
- Queue backend sync when network returns
- Never block UI on network operations

---

### 5. **Event Detail Screen** (`app/event/[id].tsx`)

**Purpose:** Show full event details, directions, and save option.

**Key Functions:**
- `useQuery("events.get", { id })` — Fetch full event details
- `handleOpenInMaps()` — Launch Maps with venue address
- `handleSaveEvent()` — Add to favorites
- `handleShare()` — Share event via system share sheet

**Failure Scenarios & Current Handling:**

| Scenario | Current Behavior | Issue | Fix Required |
|---|---|---|---|
| **Event not found (404)** | Query fails | Blank screen | Show "Event not found" message |
| **Network timeout fetching event** | Loading spinner forever | User stuck | Add 15s timeout + show cached data or error |
| **Event deleted between navigation** | 404 | Expected | Show "Event no longer available" |
| **Offline + event not in cache** | Can't load | Expected | Show "Event not cached, go online to view" |
| **Offline + event in cache** | Show cached data | Works | Mark as "Cached" |
| **Save to favorites fails** | Silent failure | User confused | Show toast: "Saved" or "Failed" |
| **Share fails** | Silent failure | User doesn't know | Show error toast |
| **Invalid coordinates for Maps** | Maps won't open | Error | Show address text instead |
| **Very long event description** | Might overflow | Layout issue | Add scrollable container |

**Offline Strategy:**
- Cache full event details when viewed
- Show cached event with "Cached" badge when offline
- Disable "Open in Maps" when offline (show address instead)
- Allow save to favorites offline

---

### 6. **Sites Management Screen** (`app/sites.tsx`)

**Purpose:** Register custom event source URLs.

**Key Functions:**
- `useQuery("sources.list")` — Fetch user-registered sources
- `handleAddSource()` — Add new source (validates URL, calls API)
- `handleToggleSource()` — Enable/disable source
- `handleDeleteSource()` — Remove user-added source

**Failure Scenarios & Current Handling:**

| Scenario | Current Behavior | Issue | Fix Required |
|---|---|---|---|
| **Network timeout loading sources** | Loading forever | User stuck | Add 15s timeout + show cached list |
| **Add source with invalid URL** | Validation error | Expected | Show clear error message |
| **Add source succeeds but sync fails** | Offline save only | Expected | Show "Saved locally, will sync when online" |
| **Delete source fails** | Silent failure | User confused | Show error toast + retry button |
| **Toggle source fails** | Silent failure | User confused | Show error toast + revert toggle |
| **Offline + can't load sources** | Show cached list | OK | Mark as "Cached" |
| **Offline + try to add source** | Can't validate/sync | Expected | Show "Add sources online" |
| **Offline + try to delete source** | Can't sync | Expected | Queue deletion for sync |

**Offline Strategy:**
- Cache source list locally
- Show cached list when offline
- Disable add/delete/toggle when offline (or queue for sync)
- Show "Offline" indicator

---

### 7. **Tab Navigation** (`app/(tabs)/_layout.tsx`)

**Purpose:** Switch between Calendar, Discover, Map, Settings tabs.

**Key Functions:**
- Tab switching logic
- Network state listener (if implemented)
- Notification handler (if implemented)

**Failure Scenarios & Current Handling:**

| Scenario | Current Behavior | Issue | Fix Required |
|---|---|---|---|
| **Network state changes** | No indication to user | User confused | Add network state listener + show indicator |
| **Tab switch while loading** | Previous query may cancel | Expected | Ensure queries complete or cache |
| **App backgrounded then restored** | Queries might be stale | Expected | Add pull-to-refresh on each tab |

**Offline Strategy:**
- Add network state listener at root level
- Show persistent "Offline" indicator when no network
- Auto-refresh when network returns

---

### 8. **Root Layout** (`app/_layout.tsx`)

**Purpose:** App-level providers, theme, auth, navigation.

**Key Functions:**
- Theme provider
- Favorites context provider
- Auth context (if implemented)
- Navigation stack

**Failure Scenarios & Current Handling:**

| Scenario | Current Behavior | Issue | Fix Required |
|---|---|---|---|
| **AsyncStorage initialization fails** | App might crash | Critical | Add error boundary at root |
| **Theme context fails** | App might crash | Critical | Add error boundary + fallback theme |
| **Favorites context fails** | App might crash | Critical | Add error boundary + fallback |
| **Navigation fails** | App might crash | Critical | Add error boundary |

**Offline Strategy:**
- Add error boundary at root level
- Gracefully degrade if any provider fails
- Show error screen with "Restart app" button

---

## Backend API Resilience

### Event List API (`events.list`)

**Failure Scenarios:**

| Scenario | Current Behavior | Fix Required |
|---|---|---|
| **Database connection fails** | Returns 500 | Add connection retry logic (3 attempts) |
| **Query timeout** | Returns 500 after 30s | Add query timeout (10s) + return partial results |
| **Invalid input parameters** | Returns 400 | Already handled by Zod validation |
| **Rate limiting** | No rate limiting | Add rate limiting (100 req/min per IP) |
| **Concurrent requests spike** | Database might overload | Add request queuing + circuit breaker |

---

## Scraper Resilience

### Hourly Event Scraper

**Failure Scenarios:**

| Scenario | Current Behavior | Fix Required |
|---|---|---|
| **Facebook API rate limit hit** | Logs error, continues | Add exponential backoff + retry queue |
| **Instagram API fails** | Logs error, continues | Same as above |
| **HTML scraper timeout** | Logs error, continues | Reduce timeout from 15s to 10s |
| **Database insert fails** | Logs error, continues | Add transaction rollback + retry |
| **Scraper crashes** | Scheduler continues | Add error handling + restart logic |
| **Scheduler misses hourly tick** | Events not updated | Add health check endpoint |

---

## Offline-First Architecture

### Local Caching Strategy

**What to cache:**
- Event list (current month + next 2 months)
- Event details (when viewed)
- User preferences
- Favorites list
- Source list
- Search results (last 50 per filter combination)

**Cache invalidation:**
- Events: 24 hours or manual refresh
- Preferences: Immediate (no TTL)
- Favorites: Immediate (no TTL)
- Sources: 24 hours or manual refresh
- Search results: 1 hour

**Storage limits:**
- AsyncStorage max ~10MB on most devices
- Estimate: ~5KB per event × 100 events = 500KB (safe)
- Preferences: ~1KB
- Favorites: ~2KB per 100 favorites
- Total: ~5MB (safe)

---

## Network State Detection

### Implementation Required

```typescript
// Listen to network state changes
import NetInfo from '@react-native-community/netinfo';

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    setIsOnline(state.isConnected ?? false);
    if (state.isConnected) {
      // Trigger sync of queued operations
      syncFavoritesIfNeeded();
      syncPreferencesIfNeeded();
      refetchStaleData();
    }
  });
  return unsubscribe;
}, []);
```

---

## Error Boundaries

### Required Error Boundaries

1. **Root Error Boundary** — Catches all unhandled errors, shows restart button
2. **Screen Error Boundaries** — Catch errors per screen, show retry button
3. **Component Error Boundaries** — Catch errors in specific components

---

## Graceful Degradation

### Feature Availability by Network State

| Feature | Online | Offline |
|---|---|---|
| View calendar | ✅ Full | ✅ Cached only |
| Search events | ✅ Full | ❌ Disabled |
| View event details | ✅ Full | ✅ Cached only |
| Save to favorites | ✅ Full | ✅ Queued |
| Open in Maps | ✅ Full | ⚠️ Web fallback |
| View map | ✅ Full | ✅ Cached pins |
| Manage sources | ✅ Full | ❌ Disabled |
| Change preferences | ✅ Full | ✅ Queued sync |

---

## Testing Checklist

- [ ] Test with WiFi disabled
- [ ] Test with airplane mode
- [ ] Test with server returning 500
- [ ] Test with database connection failure
- [ ] Test with slow network (3G simulation)
- [ ] Test with network timeout (kill server mid-request)
- [ ] Test with AsyncStorage full
- [ ] Test with corrupted AsyncStorage data
- [ ] Test with invalid event coordinates
- [ ] Test with very long event descriptions
- [ ] Test rapid tab switching while loading
- [ ] Test month navigation while offline
- [ ] Test favorites sync when network returns
- [ ] Test preferences sync when network returns
- [ ] Test app backgrounded then restored

---

## Summary

The app currently lacks comprehensive offline support and error handling. Key improvements needed:

1. **Add network state detection** — Show indicator, trigger sync
2. **Implement local caching** — Cache events, preferences, favorites
3. **Add error boundaries** — Catch and display errors gracefully
4. **Add retry logic** — Retry failed API calls with exponential backoff
5. **Add timeouts** — Prevent indefinite loading
6. **Add user feedback** — Show "Offline", "Loading", "Error" states clearly
7. **Implement graceful degradation** — Disable features that require network

These changes will make the app much more robust and user-friendly in real-world conditions.
