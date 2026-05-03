import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Events ──────────────────────────────────────────────────────────────────
export const events = mysqlTable(
  "events",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceId: int("sourceId").notNull(),
    externalId: varchar("externalId", { length: 255 }),
    // Cross-source dedup key. Hash of normalized title + start date (day
    // precision). Same physical event from different sources lands on the
    // same canonicalKey and gets merged in upsertEvent rather than duplicated.
    canonicalKey: varchar("canonicalKey", { length: 64 }),
    venueDateKey: varchar("venueDateKey", { length: 64 }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    danceStyle: mysqlEnum("danceStyle", [
      "salsa", "bachata", "zouk", "kizomba", "merengue",
      "cha-cha-cha", "cumbia", "reggaeton", "samba", "tango",
      "rumba", "mambo", "afro-latin", "mixed", "other",
    ]),
    eventType: mysqlEnum("eventType", [
      "social", "workshop", "performance", "festival",
      "class", "congress", "bootcamp", "other",
    ]),
    startAt: timestamp("startAt").notNull(),
    endAt: timestamp("endAt"),
    venueName: varchar("venueName", { length: 500 }),
    venueAddress: text("venueAddress"),
    city: varchar("city", { length: 100 }),
    prefecture: varchar("prefecture", { length: 100 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    nearestStation: varchar("nearestStation", { length: 200 }),
    imageUrl: text("imageUrl"),
    sourceUrl: text("sourceUrl"),
    price: varchar("price", { length: 200 }),
    organizer: varchar("organizer", { length: 300 }),
    isVerified: boolean("isVerified").default(false).notNull(),
    isCancelled: boolean("isCancelled").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    // UNIQUE on both keys closes the upsertEvent race window: when two
    // workers both miss the SELECT and both INSERT, the second hits a
    // duplicate-key error which upsertEvent catches and converts to a merge.
    // MySQL allows multiple NULL values in a UNIQUE index, so events without
    // a recognizable canonical/venue key still coexist.
    canonicalKeyIdx: uniqueIndex("events_canonical_key_idx").on(table.canonicalKey),
    venueDateKeyIdx: uniqueIndex("events_venue_date_key_idx").on(table.venueDateKey),
  }),
);

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

// ─── Event Sources ───────────────────────────────────────────────────────────
export const eventSources = mysqlTable("event_sources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  sourceType: mysqlEnum("sourceType", ["facebook", "instagram", "rss", "html", "custom"]).default("html").notNull(),
  region: varchar("region", { length: 100 }).default("japan"),
  isActive: boolean("isActive").default(true).notNull(),
  isUserAdded: boolean("isUserAdded").default(false).notNull(),
  lastScrapedAt: timestamp("lastScrapedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EventSource = typeof eventSources.$inferSelect;
export type InsertEventSource = typeof eventSources.$inferInsert;

// ─── Scrape Logs ─────────────────────────────────────────────────────────────
export const scrapeLogs = mysqlTable("scrape_logs", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: int("sourceId").notNull(),
  status: mysqlEnum("status", ["success", "error", "partial"]).notNull(),
  eventsFound: int("eventsFound").default(0).notNull(),
  eventsAdded: int("eventsAdded").default(0).notNull(),
  errorMessage: text("errorMessage"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── User Preferences ────────────────────────────────────────────────────────
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  city: varchar("city", { length: 100 }),
  prefecture: varchar("prefecture", { length: 100 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  maxDistanceKm: int("maxDistanceKm").default(30),
  nearestStation: varchar("nearestStation", { length: 200 }),
  maxWalkMinutes: int("maxWalkMinutes").default(15),
  danceStyleFilter: varchar("danceStyleFilter", { length: 50 }).default("all"),
  eventTypeFilters: text("eventTypeFilters"),
  notificationsEnabled: boolean("notificationsEnabled").default(true),
  notifyBeforeHours: int("notifyBeforeHours").default(24),
  theme: mysqlEnum("theme", ["light", "dark", "system"]).default("system"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;
