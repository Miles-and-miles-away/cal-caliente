import { boolean, decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: int("sourceId").notNull(),
  externalId: varchar("externalId", { length: 255 }),
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
});

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

// ─── User-Generated Events ──────────────────────────────────────────────────────
export const userEvents = mysqlTable("user_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  danceStyle: mysqlEnum("danceStyle", [
    "salsa", "bachata", "zouk", "kizomba", "merengue",
    "cha-cha-cha", "cumbia", "reggaeton", "samba", "tango",
    "rumba", "mambo", "afro-latin", "mixed", "other",
  ]).notNull(),
  eventType: mysqlEnum("eventType", [
    "social", "workshop", "performance", "festival",
    "class", "congress", "bootcamp", "other",
  ]).default("social").notNull(),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt"),
  venueName: varchar("venueName", { length: 500 }),
  venueAddress: text("venueAddress"),
  city: varchar("city", { length: 100 }),
  prefecture: varchar("prefecture", { length: 100 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  imageUrl: text("imageUrl"),
  isShared: boolean("isShared").default(false).notNull(),
  moderationStatus: mysqlEnum("moderationStatus", ["pending", "approved", "hidden"]).default("pending").notNull(),
  flaggedReason: text("flaggedReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserEvent = typeof userEvents.$inferSelect;
export type InsertUserEvent = typeof userEvents.$inferInsert;

// ─── Event Attendance ───────────────────────────────────────────────────────────
export const eventAttendance = mysqlTable("event_attendance", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventId: int("eventId").notNull(),
  status: mysqlEnum("status", ["interested", "attending", "not_attending"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EventAttendance = typeof eventAttendance.$inferSelect;
export type InsertEventAttendance = typeof eventAttendance.$inferInsert;

// ─── User Blocks ────────────────────────────────────────────────────────────────
export const userBlocks = mysqlTable("user_blocks", {
  id: int("id").autoincrement().primaryKey(),
  blockerId: int("blockerId").notNull(),
  blockedUserId: int("blockedUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserBlock = typeof userBlocks.$inferSelect;
export type InsertUserBlock = typeof userBlocks.$inferInsert;

// ─── Moderation Logs ────────────────────────────────────────────────────────────
export const moderationLogs = mysqlTable("moderation_logs", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId"),
  userId: int("userId"),
  adminId: int("adminId"),
  reason: text("reason").notNull(),
  action: mysqlEnum("action", ["flagged", "approved", "hidden", "deleted", "user_suspended"]).notNull(),
  flaggedAt: timestamp("flaggedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ModerationLog = typeof moderationLogs.$inferSelect;
export type InsertModerationLog = typeof moderationLogs.$inferInsert;
