import { createHash } from "node:crypto";
import { and, desc, eq, gte, like, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  events,
  eventSources,
  scrapeLogs,
  userPreferences,
  type Event,
  type InsertEvent,
  type InsertEventSource,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  API_DEFAULT_PAGE_SIZE,
  API_MAX_PAGE_SIZE,
} from "../shared/constants";

/**
 * Escapes special characters in LIKE patterns to prevent injection.
 * Characters %, _, and \ are escaped with a backslash prefix.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, (char) => `\\${char}`);
}

// ─── Cross-source dedup ──────────────────────────────────────────────────────
//
// computeCanonicalKey produces a stable hash that's the same for the "same
// event" reported by different sources. Used by upsertEvent to merge instead
// of duplicating. Tuned to handle the realistic spread of titles across
// sources (parenthetical prefixes, year suffixes, punctuation variance).

export function normalizeTitleForKey(title: string): string {
  return title
    .normalize("NFC")
    .toLowerCase()
    // Strip leading parenthetical/bracketed prefix: "(JAPAN) Foo", "[FESTIVAL] Foo"
    .replace(/^[(\[][^)\]]+[)\]]\s*/, "")
    // Strip 4-digit years (date provides disambiguation)
    .replace(/\b(19|20)\d{2}\b/g, "")
    // Collapse non-alphanumeric runs (incl. CJK punctuation, em-dashes) to one space
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function computeCanonicalKey(title: string, startAt: Date | string): string {
  const t = normalizeTitleForKey(title);
  const date = (startAt instanceof Date ? startAt : new Date(startAt))
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD — day precision so multi-day festivals match
  return createHash("sha256").update(`${t}|${date}`).digest("hex").slice(0, 32);
}

// Secondary dedup: same venue + same start hour. Catches cross-source events
// where titles differ but it's clearly the same gig (Club Salud's iCal vs a
// Meetup group both listing the same Tuesday class). Hour precision is
// deliberate — day precision would falsely merge the 7pm class with the 9pm
// social at the same venue.
//
// Returns null when the venue isn't useful for a key (empty or too short
// after normalization). Without a venue we fall back to canonicalKey only.
export function normalizeVenueForKey(venue: string): string {
  return venue
    .normalize("NFC")
    .toLowerCase()
    // Strip generic location-type words that vary across sources
    .replace(/\b(bar|club|studio|hall|cafe|lounge|center|centre)\b/gi, "")
    // Collapse non-alphanumeric (incl. CJK punctuation) to single space
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function computeVenueDateKey(
  venue: string | null | undefined,
  startAt: Date | string,
): string | null {
  if (!venue) return null;
  const v = normalizeVenueForKey(venue);
  // Require at least 3 characters of meaningful venue text — single-letter or
  // empty post-normalization isn't a useful dedup signal.
  if (v.length < 3) return null;
  // Hour precision: YYYY-MM-DDTHH (in UTC; close enough across sources that
  // would all be reporting the same wall-clock hour in JST).
  const hour = (startAt instanceof Date ? startAt : new Date(startAt))
    .toISOString()
    .slice(0, 13);
  return createHash("sha256").update(`${v}|${hour}`).digest("hex").slice(0, 32);
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User Queries ────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Event Queries ───────────────────────────────────────────────────────────

export async function listEvents(params: {
  danceStyle?: string;
  eventType?: string;
  city?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(events.isCancelled, false)];

  if (params.danceStyle && params.danceStyle !== "all") {
    conditions.push(eq(events.danceStyle, params.danceStyle as any));
  }
  if (params.eventType && params.eventType !== "all") {
    conditions.push(eq(events.eventType, params.eventType as any));
  }
  if (params.city) {
    conditions.push(eq(events.city, params.city));
  }
  if (params.startDate) {
    conditions.push(gte(events.startAt, new Date(params.startDate)));
  }
  if (params.endDate) {
    conditions.push(lte(events.startAt, new Date(params.endDate)));
  }
  if (params.search) {
    const term = `%${escapeLikePattern(params.search)}%`;
    conditions.push(
      or(
        like(events.title, term),
        like(events.venueName, term),
        like(events.organizer, term),
        like(events.city, term)
      )!
    );
  }

  const limit = Math.min(params.limit ?? API_DEFAULT_PAGE_SIZE, API_MAX_PAGE_SIZE);
  const offset = params.offset ?? 0;

  // Order by startAt + id so pagination is deterministic when two events share
  // a timestamp — otherwise an offset query can skip or repeat rows.
  return db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(events.startAt, events.id)
    .limit(limit)
    .offset(offset);
}

export async function getEvent(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Events that have a venue address but no coordinates yet — candidates for
 * the post-scrape geocoding backfill.
 */
export async function getEventsMissingCoordinates(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: events.id, venueAddress: events.venueAddress })
    .from(events)
    .where(and(sql`${events.latitude} IS NULL`, sql`${events.venueAddress} IS NOT NULL`))
    .limit(limit);
}

export async function updateEventCoordinates(
  id: number,
  latitude: number,
  longitude: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Decimal columns round-trip as strings in drizzle's mysql driver; the
  // columns are decimal(10,7) so fix the scale explicitly.
  await db
    .update(events)
    .set({ latitude: latitude.toFixed(7), longitude: longitude.toFixed(7) })
    .where(eq(events.id, id));
}

// Merge incoming fields into an existing row, preferring incoming values when
// they're non-empty and falling back to existing values otherwise. Picks the
// "richer" data across re-runs and across sources.
export function mergeEventFields(existing: Event, incoming: InsertEvent): Partial<InsertEvent> {
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    // Skip immutable identity fields and the dedup key — they're set once.
    if (key === "id" || key === "createdAt" || key === "canonicalKey") continue;
    const isMeaningful = value !== null && value !== undefined && value !== "";
    if (isMeaningful) {
      merged[key] = value;
    }
    // If incoming is empty/null, leave the existing value untouched (don't write null over a real value).
  }
  return merged as Partial<InsertEvent>;
}

// MySQL "duplicate key" error fingerprint. Drizzle/mysql2 sets both `code`
// (string) and `errno` (number) on the thrown error. Newer Drizzle versions
// wrap the underlying error in a `DrizzleQueryError` and put the original on
// `cause`, so we recurse through the chain. Limit depth to avoid pathological
// circular references.
export function isDuplicateKeyError(err: unknown, depth = 0): boolean {
  if (depth > 5 || typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; errno?: unknown; cause?: unknown };
  if (e.code === "ER_DUP_ENTRY" || e.errno === 1062) return true;
  if (e.cause && e.cause !== err) return isDuplicateKeyError(e.cause, depth + 1);
  return false;
}

interface ExistingMatch {
  row: Event;
  matchedBy: "canonicalKey" | "venueDateKey";
}

async function findExistingEvent(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  canonicalKey: string,
  venueDateKey: string | null,
): Promise<ExistingMatch | null> {
  const byCanonical = await db
    .select()
    .from(events)
    .where(eq(events.canonicalKey, canonicalKey))
    .limit(1);
  if (byCanonical.length > 0) {
    return { row: byCanonical[0], matchedBy: "canonicalKey" };
  }
  if (venueDateKey) {
    const byVenue = await db
      .select()
      .from(events)
      .where(eq(events.venueDateKey, venueDateKey))
      .limit(1);
    if (byVenue.length > 0) {
      return { row: byVenue[0], matchedBy: "venueDateKey" };
    }
  }
  return null;
}

// Internal upsert that takes the db connection explicitly so it's directly
// testable — the public `upsertEvent` just resolves the db and delegates here.
// Exported so tests can drive the dedup / race-recovery logic with a mocked db
// without trying to intercept the real `getDb` call.
export async function upsertEventWithDb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  event: InsertEvent,
) {
  const startAt = event.startAt instanceof Date
    ? event.startAt
    : new Date(event.startAt as string);
  const canonicalKey = computeCanonicalKey(event.title, startAt);
  const venueDateKey = computeVenueDateKey(event.venueName, startAt);
  const eventWithKeys: InsertEvent = { ...event, canonicalKey, venueDateKey };

  // Two-level cross-source dedup:
  //   1. canonicalKey (title + date) — catches matching titles
  //   2. venueDateKey (venue + hour) — catches same-event-different-titles
  // Either match merges instead of inserting.
  const existing = await findExistingEvent(db, canonicalKey, venueDateKey);

  if (existing) {
    await applyMerge(db, existing, eventWithKeys);
    return;
  }

  // INSERT race fallback: with UNIQUE indexes on canonicalKey and
  // venueDateKey, a sibling worker may have inserted between our SELECT and
  // INSERT. The DB throws ER_DUP_ENTRY; we re-query and merge into whatever
  // they wrote. This converts the race from a duplicate-row bug into an
  // ordering-doesn't-matter merge.
  try {
    await db.insert(events).values(eventWithKeys);
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const winner = await findExistingEvent(db, canonicalKey, venueDateKey);
    if (!winner) {
      // Lost the race but the row's already gone (deleted between the
      // duplicate-key error and our re-fetch). Bail; nothing to merge.
      return;
    }
    await applyMerge(db, winner, eventWithKeys);
  }
}

export async function upsertEvent(event: InsertEvent) {
  const db = await getDb();
  if (!db) return;
  return upsertEventWithDb(db, event);
}

async function applyMerge(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  existing: ExistingMatch,
  incoming: InsertEvent,
) {
  // Defensive: when the match was via venueDateKey only AND the existing
  // row's canonicalKey is set and differs from the incoming event's, we may
  // be merging two genuinely-different events (parallel programming at the
  // same venue same hour). The merge still proceeds — that's the documented
  // behaviour of venueDateKey dedup — but we log so the case is visible if
  // it ever turns out to be common in production.
  if (
    existing.matchedBy === "venueDateKey" &&
    existing.row.canonicalKey &&
    existing.row.canonicalKey !== incoming.canonicalKey
  ) {
    console.warn(
      `[upsertEvent] venueDateKey-only match: incoming "${incoming.title}" merging into ` +
        `existing "${existing.row.title}" (different canonicalKeys). ` +
        `If this is a parallel event at the same venue, the merge is wrong.`,
    );
  }
  const merged = mergeEventFields(existing.row, incoming);
  if (Object.keys(merged).length > 0) {
    await db.update(events).set(merged).where(eq(events.id, existing.row.id));
  }
}

// ─── Source Queries ──────────────────────────────────────────────────────────

export async function listSources() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventSources).orderBy(eventSources.name);
}

export async function getActiveSources() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventSources).where(eq(eventSources.isActive, true));
}

export async function addSource(source: InsertEventSource) {
  const db = await getDb();
  if (!db) return;
  await db.insert(eventSources).values(source);
}

export async function toggleSource(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(eventSources).set({ isActive }).where(eq(eventSources.id, id));
}

export async function deleteSource(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(eventSources).where(
    and(eq(eventSources.id, id), eq(eventSources.isUserAdded, true))
  );
}

export async function updateSourceScrapedAt(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(eventSources).set({ lastScrapedAt: new Date() }).where(eq(eventSources.id, id));
}

// ─── Scrape Log Queries ──────────────────────────────────────────────────────

export async function addScrapeLog(log: {
  sourceId: number;
  status: "success" | "error" | "partial";
  eventsFound: number;
  eventsAdded: number;
  errorMessage?: string;
  durationMs?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(scrapeLogs).values(log);
}

export async function getRecentScrapeLogs(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scrapeLogs).orderBy(desc(scrapeLogs.createdAt)).limit(limit);
}

export async function pruneOldScrapeLogs(retainDays = 30) {
  const db = await getDb();
  if (!db) return;
  const cutoff = new Date(Date.now() - retainDays * 24 * 60 * 60 * 1000);
  await db.delete(scrapeLogs).where(lt(scrapeLogs.createdAt, cutoff));
}

// ─── User Preferences Queries ────────────────────────────────────────────────

export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// Allowlist of fields a router is permitted to set on user_preferences. Spreads
// from untrusted input would otherwise let a caller write arbitrary columns
// (mass assignment), so we filter here defensively even when callers think
// they validated upstream.
const USER_PREF_FIELDS = [
  "city",
  "prefecture",
  "latitude",
  "longitude",
  "maxDistanceKm",
  "nearestStation",
  "maxWalkMinutes",
  "danceStyleFilter",
  "eventTypeFilters",
  "notificationsEnabled",
  "notifyBeforeHours",
  "theme",
] as const;

export async function upsertUserPreferences(userId: number, prefs: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  const safe: Record<string, unknown> = {};
  for (const field of USER_PREF_FIELDS) {
    if (field in prefs) safe[field] = prefs[field];
  }
  const existing = await getUserPreferences(userId);
  if (existing) {
    await db.update(userPreferences).set(safe).where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({ userId, ...safe } as any);
  }
}
