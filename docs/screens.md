# Screens Reference

**Last Updated:** 2026-04-17

---

## Calendar Screen (`app/(tabs)/index.tsx`)

The home screen presents a monthly calendar grid with color-coded event dots. Users navigate months with left/right arrows and tap any date to see events below the grid.

### Components Used

| Component | Purpose |
|-----------|---------|
| `ScreenContainer` | SafeArea wrapper |
| `FlatList` | Renders event list below calendar |
| `EventCard` | Displays individual event summary |
| `FilterChips` | Dance style filter row |

### State

| Variable | Type | Description |
|----------|------|-------------|
| `currentMonth` | `number` | Currently displayed month (0-11) |
| `currentYear` | `number` | Currently displayed year |
| `selectedDate` | `Date` | Date tapped by user |
| `danceFilter` | `string` | Active dance style filter (`"all"`, `"salsa"`, `"bachata"`, `"both"`) |

### Data

The screen queries `trpc.events.list` for the entire displayed month, then groups events by date into a `Record<string, Event[]>` map. Event dots on each calendar cell are derived from the unique dance styles present on that date, using `DANCE_STYLE_COLORS` for coloring.

---

## Discover Screen (`app/(tabs)/discover.tsx`)

A search-and-filter screen for finding events across all cities and date ranges. It combines a text search bar with three rows of filter chips.

### Filters

| Filter Row | Options | Default |
|------------|---------|---------|
| Dance Style | All, Salsa, Bachata, Both, Other | All |
| City | (empty = all), Tokyo, Osaka, Nagoya, Yokohama, Fukuoka, Kobe, Sapporo, Kyoto | All |
| Date Range | Upcoming, This Week, This Month | Upcoming |

### Features

The search bar supports full-text search across event titles, venue names, organizer names, and cities. The "Manage Event Sources" card links to the `/sites` screen where users can register custom scraping targets. Results count is displayed above the event list.

---

## Map Screen (`app/(tabs)/map.tsx`)

Displays events grouped by city with location metadata. Each event row shows a color-coded dance style dot, venue name, nearest station, and formatted date/time.

### Design Note

The current implementation uses a list-based city grouping rather than an interactive map widget. This is intentional for two reasons: (1) `react-native-maps` requires native builds and does not work in Expo Go, and (2) Google Maps integration is available via the "Open in Maps" action on each event's detail page. A future enhancement could add `expo-maps` when the app is built for production.

### Data Pipeline

1. Query `trpc.events.list` for the next 60 days (configurable via `API_EVENT_LOOKAHEAD_DAYS`)
2. Filter events to only those with valid `latitude` and `longitude`
3. Group by `city` field into a `Record<string, Event[]>`
4. Sort city names alphabetically
5. Render each city section with its event rows

---

## Preferences Screen (`app/(tabs)/preferences.tsx`)

Stores user settings locally via `AsyncStorage`. Settings persist across app restarts.

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| City | Picker | `"Tokyo"` | User's current city for location-based filtering |
| Max Distance | Slider | `10` km | Maximum distance from nearest station |
| Dance Style | Multi-select | All styles | Preferred dance styles to show |
| Notifications | Toggle | `true` | Enable/disable new event notifications |

### Persistence

Settings are saved to `AsyncStorage` under the key `"user_preferences"` as a JSON string. The screen loads saved settings on mount and saves after every change.

---

## Event Detail Screen (`app/event/[id].tsx`)

A full-page event view accessed by tapping any EventCard. Presented as a card (push navigation) with a back button.

### Sections

| Section | Content |
|---------|---------|
| Header | Dance style badge, event type badge, verified icon |
| Title | Event title (large, bold) |
| Date & Time | Formatted start and end times |
| Venue | Venue name, full address, nearest station |
| Description | Full event description text |
| Price | Admission price if available |
| Organizer | Organizer name |
| Source | Link to original event page (opens in browser) |
| Map Action | "Open in Maps" button that launches native Maps with coordinates |

### Data

Fetches a single event via `trpc.events.getById` using the `id` route parameter. Shows a loading spinner while fetching and an error state if the event is not found.

---

## Sites Screen (`app/sites.tsx`)

Allows users to register custom event sources (dance school websites, social media pages) for the scraper to monitor.

### Features

| Feature | Description |
|---------|-------------|
| Source List | Displays all sources with name, URL, type, and active status |
| Add Source | Form with name, URL, and source type picker |
| Toggle Active | Switch to enable/disable scraping for a source |
| Delete | Remove user-added sources (system sources cannot be deleted) |

### Source Types

| Type | Label | Description |
|------|-------|-------------|
| `html` | Website | Generic HTML page scraped with LLM extraction |
| `facebook` | Facebook | Facebook Page (requires Graph API token) |
| `instagram` | Instagram | Instagram account (requires Graph API token) |
| `rss` | RSS/iCal | RSS feed or iCal calendar URL |

### Validation

Source URLs are validated on the frontend (non-empty, reasonable format) and on the backend (protocol check, length limit, sanitization). Source names are trimmed and capped at 255 characters.
