import { and, desc, eq, gte, like, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  events,
  eventSources,
  scrapeLogs,
  userPreferences,
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

export async function upsertEvent(event: InsertEvent) {
  const db = await getDb();
  if (!db) return;
  if (event.externalId) {
    const existing = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.sourceId, event.sourceId),
          eq(events.externalId, event.externalId)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      await db.update(events).set(event).where(eq(events.id, existing[0].id));
      return;
    }
  }
  await db.insert(events).values(event);
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
