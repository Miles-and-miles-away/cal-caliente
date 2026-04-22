import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  events,
  eventSources,
  scrapeLogs,
  userPreferences,
  userEvents,
  eventAttendance,
  userBlocks,
  moderationLogs,
  type InsertEvent,
  type InsertEventSource,
  type InsertUserEvent,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  API_DEFAULT_PAGE_SIZE,
  API_MAX_PAGE_SIZE,
} from "../shared/constants";
import { notInArray, count } from "drizzle-orm";

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

  return db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(events.startAt)
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

export async function upsertUserPreferences(userId: number, prefs: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  const existing = await getUserPreferences(userId);
  if (existing) {
    await db.update(userPreferences).set(prefs).where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({ userId, ...prefs } as any);
  }
}


// ─── User-Generated Events Queries ───────────────────────────────────────────

export async function createUserEvent(event: {
  userId: number;
  title: string;
  description?: string;
  danceStyle: string;
  eventType: string;
  startAt: Date;
  endAt?: Date;
  venueName?: string;
  venueAddress?: string;
  city?: string;
  prefecture?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  isShared: boolean;
  moderationStatus: "pending" | "approved" | "hidden";
  flaggedReason?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(userEvents).values(event as any);
  return result;
}

export async function getUserEvents(userId: number, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userEvents)
    .where(eq(userEvents.userId, userId))
    .orderBy(desc(userEvents.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getSharedUserEvents(limit = 100, offset = 0, excludeBlockedUsers: number[] = []) {
  const db = await getDb();
  if (!db) return [];
  
  let whereConditions = [
    eq(userEvents.isShared, true),
    eq(userEvents.moderationStatus, "approved" as any),
  ];
  
  if (excludeBlockedUsers.length > 0) {
    whereConditions.push(notInArray(userEvents.userId, excludeBlockedUsers));
  }
  
  return db
    .select()
    .from(userEvents)
    .where(and(...whereConditions))
    .orderBy(desc(userEvents.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function updateUserEvent(eventId: number, updates: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(userEvents).set(updates).where(eq(userEvents.id, eventId));
}

export async function deleteUserEvent(eventId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userEvents).where(eq(userEvents.id, eventId));
}

// ─── Event Attendance Queries ────────────────────────────────────────────────

export async function recordAttendance(userId: number, eventId: number, status: "interested" | "attending" | "not_attending") {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await db
    .select()
    .from(eventAttendance)
    .where(and(eq(eventAttendance.userId, userId), eq(eventAttendance.eventId, eventId)))
    .limit(1);
  
  if (existing.length > 0) {
    await db
      .update(eventAttendance)
      .set({ status })
      .where(and(eq(eventAttendance.userId, userId), eq(eventAttendance.eventId, eventId)));
  } else {
    await db.insert(eventAttendance).values({ userId, eventId, status });
  }
}

export async function getAttendanceCount(eventId: number, status?: string) {
  const db = await getDb();
  if (!db) return 0;
  
  let whereConditions = [eq(eventAttendance.eventId, eventId)];
  if (status) {
    whereConditions.push(eq(eventAttendance.status, status as any));
  }
  
  const result = await db
    .select({ count: count() })
    .from(eventAttendance)
    .where(and(...whereConditions));
  
  return result[0]?.count || 0;
}

export async function getUserAttendance(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(eventAttendance)
    .where(eq(eventAttendance.userId, userId))
    .orderBy(desc(eventAttendance.createdAt));
}

// ─── User Blocks Queries ─────────────────────────────────────────────────────

export async function blockUser(blockerId: number, blockedUserId: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userBlocks).values({ blockerId, blockedUserId });
}

export async function unblockUser(blockerId: number, blockedUserId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedUserId, blockedUserId)));
}

export async function getBlockedUsers(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userBlocks).where(eq(userBlocks.blockerId, userId));
}

// ─── Moderation Logs Queries ─────────────────────────────────────────────────

export async function addModerationLog(log: {
  eventId?: number;
  userId?: number;
  adminId?: number;
  reason: string;
  action: string;
  resolvedAt?: Date;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(moderationLogs).values(log as any);
}

export async function getFlaggedEvents(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userEvents)
    .where(eq(userEvents.moderationStatus, "pending"))
    .orderBy(desc(userEvents.createdAt))
    .limit(limit)
    .offset(offset);
}


