import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createConnection } from "mysql2/promise";
import { eq } from "drizzle-orm";
import {
  DuplicateEventError,
  insertSubmittedEventWithDb,
  listEventsWithDb,
  upsertEventWithDb,
} from "../server/db";
import { events, eventSources } from "../drizzle/schema";

/**
 * Integration tier: runs the dedup/constraint logic against a REAL MySQL so
 * the UNIQUE-index behavior the unit tests mock (ER_DUP_ENTRY shapes, multiple
 * NULLs in a UNIQUE column, LIKE escaping) is verified against the actual
 * server. Opt-in by design — set TEST_DATABASE_URL to a database name you are
 * happy to have WIPED, e.g. with the local Docker MySQL on :3307:
 *
 *   TEST_DATABASE_URL='mysql://user:pass@localhost:3307/cal_caliente_test' npm run test:integration
 *
 * The database is created if missing and migrated via drizzle's journal.
 * Without TEST_DATABASE_URL the whole suite is skipped (normal `npm test`).
 */
const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "";

describe.skipIf(!TEST_DB_URL)("MySQL integration — dedup constraints for real", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    // Create the test database if it doesn't exist yet, then migrate it.
    const url = new URL(TEST_DB_URL);
    const dbName = url.pathname.slice(1).replace(/`/g, "");
    const admin = await createConnection({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    });
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await admin.end();

    db = drizzle(TEST_DB_URL);
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await (db as any)?.$client?.end?.();
  });

  let sourceId: number;

  beforeEach(async () => {
    await db.delete(events);
    await db.delete(eventSources);
    const res: any = await db.insert(eventSources).values({
      name: "Integration Source",
      url: "https://example.com/feed",
      sourceType: "custom",
      isActive: true,
      isUserAdded: false,
    });
    sourceId = Number(res?.[0]?.insertId ?? res?.insertId);
  });

  const baseEvent = (overrides: Record<string, unknown> = {}) => ({
    sourceId,
    title: "Tokyo Salsa Night",
    startAt: new Date("2026-07-10T19:00:00+09:00"),
    ...overrides,
  });

  const allRows = () => db.select().from(events);

  it("merges a re-scrape with a normalized-equal title instead of duplicating", async () => {
    await expect(upsertEventWithDb(db, baseEvent())).resolves.toBe("inserted");
    await expect(
      upsertEventWithDb(
        db,
        baseEvent({ title: "(JAPAN) Tokyo Salsa Night 2026!!", description: "richer data" }),
      ),
    ).resolves.toBe("merged");

    const rows = await allRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("richer data"); // merge enriched the row
  });

  it("allows many events without venues — multiple NULL venueDateKeys coexist", async () => {
    // The schema comment relies on MySQL permitting multiple NULLs in a UNIQUE
    // column. If that assumption ever broke, every venue-less event after the
    // first would vanish.
    await expect(upsertEventWithDb(db, baseEvent({ title: "Event One" }))).resolves.toBe(
      "inserted",
    );
    await expect(upsertEventWithDb(db, baseEvent({ title: "Event Two" }))).resolves.toBe(
      "inserted",
    );
    expect(await allRows()).toHaveLength(2);
  });

  it("merges different titles at the same venue and hour (venueDateKey)", async () => {
    await expect(
      upsertEventWithDb(db, baseEvent({ title: "Salsa Class", venueName: "Club Salud" })),
    ).resolves.toBe("inserted");
    await expect(
      upsertEventWithDb(
        db,
        baseEvent({ title: "Beginner Latin Lesson", venueName: "Club Salud" }),
      ),
    ).resolves.toBe("merged");
    expect(await allRows()).toHaveLength(1);
  });

  it("rejects a user submission duplicating a scraped event via a real ER_DUP_ENTRY", async () => {
    await upsertEventWithDb(db, baseEvent());
    // Same title+day → canonicalKey UNIQUE fires inside MySQL; this validates
    // isDuplicateKeyError against the genuine driver error, not a mocked shape.
    await expect(
      insertSubmittedEventWithDb(
        db,
        { title: "Tokyo Salsa Night!!", startAt: "2026-07-10T21:00:00+09:00" },
        42,
      ),
    ).rejects.toBeInstanceOf(DuplicateEventError);
    expect(await allRows()).toHaveLength(1);
  });

  it("keeps submitter attribution when a scrape later merges into a submission", async () => {
    const { id } = await insertSubmittedEventWithDb(
      db,
      { title: "Community Bachata Social", startAt: "2026-07-12T18:00:00+09:00" },
      42,
    );
    expect(id).toBeGreaterThan(0);

    await expect(
      upsertEventWithDb(
        db,
        baseEvent({
          title: "Community Bachata Social",
          startAt: new Date("2026-07-12T18:00:00+09:00"),
          description: "from the scraper",
        }),
      ),
    ).resolves.toBe("merged");

    const rows = await allRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].submittedByUserId).toBe(42); // protected by MERGE_IMMUTABLE_FIELDS
    expect(rows[0].isVerified).toBe(false);
    expect(rows[0].sourceId).toBe(sourceId); // reattributed to the real source
    expect(rows[0].description).toBe("from the scraper");
  });

  it("excludes cancelled events and escapes LIKE wildcards in real queries", async () => {
    await db.insert(events).values([
      { ...baseEvent({ title: "50%off Special" }), canonicalKey: "k1" },
      { ...baseEvent({ title: "50 xx off Special" }), canonicalKey: "k2" },
      { ...baseEvent({ title: "Cancelled Party", isCancelled: true }), canonicalKey: "k3" },
    ] as any);

    const all = await listEventsWithDb(db, {});
    expect(all.map((r) => r.title).sort()).toEqual(["50 xx off Special", "50%off Special"]);

    // Unescaped, '%50%off%' would match both rows; escaping makes it literal.
    const searched = await listEventsWithDb(db, { search: "50%off" });
    expect(searched.map((r) => r.title)).toEqual(["50%off Special"]);
  });

  it("round-trips an update through the UNIQUE indexes without clobbering keys", async () => {
    await upsertEventWithDb(db, baseEvent({ venueName: "Club Salud" }));
    const [row] = await allRows();
    // Re-scrape of the same event: keys recomputed identically, merge path
    // updates in place rather than tripping its own UNIQUE constraints.
    await expect(
      upsertEventWithDb(db, baseEvent({ venueName: "Club Salud", price: "¥2,000" })),
    ).resolves.toBe("merged");
    const [after] = await db.select().from(events).where(eq(events.id, row.id));
    expect(after.price).toBe("¥2,000");
    expect(after.canonicalKey).toBe(row.canonicalKey);
    expect(after.venueDateKey).toBe(row.venueDateKey);
  });
});
