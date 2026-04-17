# Routing & Navigation

**Last Updated:** 2026-04-17

---

## Overview

The app uses **Expo Router 6** with file-based routing. The navigation structure consists of a root Stack navigator containing a Tab navigator (4 tabs) and two modal-style screens.

---

## Route Map

```
app/
├── _layout.tsx              → Root Stack Navigator
├── (tabs)/
│   ├── _layout.tsx          → Tab Navigator (4 tabs)
│   ├── index.tsx            → Calendar tab (home)
│   ├── discover.tsx         → Discover tab (search & filters)
│   ├── map.tsx              → Map tab (location-based view)
│   └── preferences.tsx      → Settings tab (user preferences)
├── event/
│   └── [id].tsx             → Event Detail (card presentation)
├── sites.tsx                → Event Sources management (card presentation)
└── oauth/
    └── callback.tsx         → OAuth callback (system, do not modify)
```

---

## Screen Details

| Route | Tab | Presentation | Description |
|-------|-----|-------------|-------------|
| `/(tabs)/` | Calendar | Tab | Monthly calendar grid with event dots and filtered event list |
| `/(tabs)/discover` | Discover | Tab | Full-text search with dance style, city, and date range filters |
| `/(tabs)/map` | Map | Tab | Events grouped by city with location data and directions |
| `/(tabs)/preferences` | Settings | Tab | User preferences for city, distance, styles, and notifications |
| `/event/[id]` | — | Card (push) | Full event detail with venue, map link, organizer, and source |
| `/sites` | — | Card (push) | Manage registered event sources (add, toggle, delete) |

---

## Navigation Flows

### Primary Flow: Browse Calendar → Event Detail

1. User opens app → lands on **Calendar** tab
2. User taps a date → events for that date appear below the grid
3. User taps an **EventCard** → pushes to `/event/[id]`
4. User taps "Open in Maps" → opens native Maps or Google Maps
5. User taps back arrow → returns to Calendar

### Discovery Flow: Search → Event Detail

1. User taps **Discover** tab
2. User types in search bar and/or selects filter chips
3. Results update in real-time via React Query
4. User taps an event → pushes to `/event/[id]`

### Source Registration Flow

1. User taps **Settings** tab
2. User taps "Manage Event Sources" → pushes to `/sites`
3. User taps **+** button → add form appears
4. User fills in name, URL, and source type → taps "Add Source"
5. Source appears in list with toggle switch and delete option

### Map Flow: City Browse → Directions

1. User taps **Map** tab
2. Events are grouped by city with filter chips for dance style and city
3. User taps an event row → pushes to `/event/[id]`
4. From event detail, user taps venue card → opens Maps app with coordinates

---

## Tab Bar Configuration

| Tab | Icon (SF Symbol) | Material Icon | Route |
|-----|------------------|---------------|-------|
| Calendar | `calendar` | `event` | `/(tabs)/index` |
| Discover | `magnifyingglass` | `search` | `/(tabs)/discover` |
| Map | `map.fill` | `map` | `/(tabs)/map` |
| Settings | `gearshape.fill` | `settings` | `/(tabs)/preferences` |

---

## Deep Linking

The app supports deep linking via the scheme configured in `app.config.ts`. The scheme is auto-generated from the bundle ID timestamp (e.g., `manus20260417`).

Supported deep link patterns:

| Pattern | Resolves To |
|---------|-------------|
| `{scheme}://` | Calendar (home) |
| `{scheme}://discover` | Discover tab |
| `{scheme}://map` | Map tab |
| `{scheme}://preferences` | Settings tab |
| `{scheme}://event/{id}` | Event detail screen |
| `{scheme}://sites` | Event sources screen |
