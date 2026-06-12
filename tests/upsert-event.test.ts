import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Event, InsertEvent } from "../drizzle/schema";
import {
  isDuplicateKeyError,
  mergeEventFields,
  upsertEventWithDb,
} from "../server/db";

// Mock Drizzle's chained query API so we can drive upsertEvent without a real
// MySQL. The mock supports the call shapes upsertEvent uses:
//   db.select().from(...).where(...).limit(1)  → returns Promise<rows>
//   db.insert(...).values(...)                  → may resolve or throw
//   db.update(...).set(...).where(...)          → records the update
const selectResults: any[][] = [];
const updateCalls: Array<{ set: Record<string, unknown> }> = [];
let insertImpl: () => Promise<void> = () => Promise.resolve();
const insertValues: InsertEvent[] = [];

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(selectResults.shift() ?? []),
      }),
    }),
  }),
  insert: () => ({
    values: (v: InsertEvent) => {
      insertValues.push(v);
      return insertImpl();
    },
  }),
  update: () => ({
    set: (s: Record<string, unknown>) => ({
      where: () => {
        updateCalls.push({ set: s });
        return Promise.resolve();
      },
    }),
  }),
} as any;

// Synthesise a complete `events` row for merge tests.
function makeRow(overrides: Partial<Event> = {}): Event {
  return {
    id: 1,
    sourceId: 10,
    externalId: "ext-1",
    canonicalKey: "abc123",
    venueDateKey: "venue-hash-1",
    title: "Existing event",
    description: "Existing description",
    danceStyle: "salsa",
    eventType: "social",
    startAt: new Date("2026-06-15T19:00:00Z"),
    endAt: new Date("2026-06-15T22:00:00Z"),
    isAllDay: false,
    venueName: "Club Salud",
    venueAddress: "Tokyo address",
    city: "Tokyo",
    prefecture: "Tokyo",
    latitude: "35.7281000",
    longitude: "139.7706000",
    nearestStation: "Nippori",
    imageUrl: null,
    sourceUrl: "https://example.com/event/1",
    price: "¥2000",
    organizer: "Salud",
    submittedByUserId: null,
    isVerified: false,
    isCancelled: false,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
    ...overrides,
  };
}

describe("isDuplicateKeyError", () => {
  it("returns true for direct mysql2 ER_DUP_ENTRY shape", () => {
    expect(isDuplicateKeyError({ code: "ER_DUP_ENTRY", errno: 1062 })).toBe(true);
  });

  it("returns true on errno alone", () => {
    expect(isDuplicateKeyError({ errno: 1062 })).toBe(true);
  });

  it("returns true on code alone", () => {
    expect(isDuplicateKeyError({ code: "ER_DUP_ENTRY" })).toBe(true);
  });

  it("walks err.cause to find a wrapped duplicate-key error", () => {
    const wrapped = {
      name: "DrizzleQueryError",
      message: "Failed to execute query",
      cause: { code: "ER_DUP_ENTRY", errno: 1062 },
    };
    expect(isDuplicateKeyError(wrapped)).toBe(true);
  });

  it("handles two-level nesting", () => {
    const deep = {
      cause: { cause: { code: "ER_DUP_ENTRY" } },
    };
    expect(isDuplicateKeyError(deep)).toBe(true);
  });

  it("does not loop forever on a self-referential cause", () => {
    const cyclic: any = { code: "OTHER_ERROR" };
    cyclic.cause = cyclic;
    expect(isDuplicateKeyError(cyclic)).toBe(false);
  });

  it("returns false for unrelated errors", () => {
    expect(isDuplicateKeyError(new Error("network blip"))).toBe(false);
    expect(isDuplicateKeyError({ code: "ER_NO_SUCH_TABLE" })).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError(undefined)).toBe(false);
    expect(isDuplicateKeyError("ER_DUP_ENTRY")).toBe(false);
  });
});

describe("mergeEventFields", () => {
  it("prefers incoming non-empty values over existing", () => {
    const existing = makeRow({ description: null, latitude: null, longitude: null });
    const incoming: InsertEvent = {
      sourceId: 10,
      title: "Existing event",
      startAt: new Date(),
      description: "Now we have a description",
      latitude: "35.7281000",
      longitude: "139.7706000",
    };
    const merged = mergeEventFields(existing, incoming);
    expect(merged.description).toBe("Now we have a description");
    expect(merged.latitude).toBe("35.7281000");
  });

  it("does NOT overwrite existing non-empty values with null/undefined incoming", () => {
    const existing = makeRow({ description: "Real description", price: "¥3000" });
    const incoming: InsertEvent = {
      sourceId: 10,
      title: "Existing event",
      startAt: new Date(),
      description: null as any,
      price: undefined as any,
    };
    const merged = mergeEventFields(existing, incoming);
    expect(merged.description).toBeUndefined(); // not in the merge — existing kept
    expect(merged.price).toBeUndefined();
  });

  it("treats empty string as 'no incoming value' (kept existing)", () => {
    const existing = makeRow({ description: "Real description" });
    const incoming: InsertEvent = {
      sourceId: 10,
      title: "Existing event",
      startAt: new Date(),
      description: "",
    };
    const merged = mergeEventFields(existing, incoming);
    expect(merged.description).toBeUndefined();
  });

  it("never overwrites immutable identity fields", () => {
    const existing = makeRow({ id: 99, canonicalKey: "old-key", createdAt: new Date("2020-01-01") });
    const incoming: InsertEvent = {
      sourceId: 11,
      title: "Trying to forge",
      startAt: new Date(),
      canonicalKey: "new-key",
      createdAt: new Date("2099-01-01"),
    } as any;
    const merged = mergeEventFields(existing, incoming);
    expect(merged.canonicalKey).toBeUndefined();
    expect(merged.createdAt).toBeUndefined();
    expect((merged as any).id).toBeUndefined();
  });

  it("returns an empty object when incoming has nothing meaningful to merge", () => {
    const existing = makeRow();
    const incoming: InsertEvent = {
      sourceId: 10,
      title: "",
      startAt: new Date(),
      description: null as any,
      price: "" as any,
    };
    const merged = mergeEventFields(existing, incoming);
    // sourceId and startAt are still meaningful (numbers/Dates are non-null/non-empty),
    // so they end up in the merge. That's expected — we re-set them but to the
    // same values, no harm.
    expect(merged.title).toBeUndefined();
    expect(merged.description).toBeUndefined();
  });

  it("lets a re-scrape un-cancel an event (isCancelled is mergeable by design)", () => {
    // Documented behavior, not an accident: isCancelled is deliberately NOT in
    // MERGE_IMMUTABLE_FIELDS, so a source that re-lists an event as active
    // flips it back. `false` is a boolean — meaningful — and must merge, unlike
    // null/"" which are skipped. If cancellation should ever become sticky,
    // this test is the conscious decision point.
    const existing = makeRow({ isCancelled: true });
    const incoming: InsertEvent = {
      sourceId: 10,
      title: "Existing event",
      startAt: new Date(),
      isCancelled: false,
    };
    const merged = mergeEventFields(existing, incoming);
    expect(merged.isCancelled).toBe(false);
  });
});

describe("upsertEvent — race recovery", () => {
  beforeEach(() => {
    selectResults.length = 0;
    updateCalls.length = 0;
    insertValues.length = 0;
    insertImpl = () => Promise.resolve();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const incomingEvent: InsertEvent = {
    sourceId: 10,
    title: "Tokyo Salsa Social",
    startAt: new Date("2026-06-15T19:00:00+09:00"),
    venueName: "Club Salud",
    description: "Real social with live DJ",
  };

  it("inserts when both lookups miss and INSERT succeeds", async () => {
    selectResults.push([]); // canonicalKey lookup
    selectResults.push([]); // venueDateKey lookup
    insertImpl = () => Promise.resolve();

    await upsertEventWithDb(mockDb, incomingEvent);

    expect(insertValues).toHaveLength(1);
    expect(updateCalls).toHaveLength(0);
  });

  it("updates the existing row when canonicalKey matches", async () => {
    const existing = makeRow({ id: 7, description: null });
    selectResults.push([existing]); // canonicalKey hit

    await upsertEventWithDb(mockDb, incomingEvent);

    expect(insertValues).toHaveLength(0);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].set.description).toBe("Real social with live DJ");
  });

  it("recovers from a duplicate-key race by re-fetching and merging", async () => {
    selectResults.push([]); // pre-INSERT canonicalKey lookup → miss
    selectResults.push([]); // pre-INSERT venueDateKey lookup → miss
    // Simulate a sibling worker that won the race — INSERT throws
    // ER_DUP_ENTRY, then the post-failure lookup finds the row.
    insertImpl = () =>
      Promise.reject({ code: "ER_DUP_ENTRY", errno: 1062 });
    const winner = makeRow({ id: 42, description: null });
    selectResults.push([winner]); // post-failure canonicalKey lookup → hit

    await upsertEventWithDb(mockDb, incomingEvent);

    expect(insertValues).toHaveLength(1); // we tried once
    expect(updateCalls).toHaveLength(1);   // and recovered with an UPDATE
    expect(updateCalls[0].set.description).toBe("Real social with live DJ");
  });

  it("recovers from a duplicate-key race when err.cause carries the code", async () => {
    selectResults.push([]);
    selectResults.push([]);
    insertImpl = () =>
      Promise.reject({
        name: "DrizzleQueryError",
        message: "Failed query",
        cause: { code: "ER_DUP_ENTRY", errno: 1062 },
      });
    const winner = makeRow({ id: 99 });
    selectResults.push([winner]);

    await upsertEventWithDb(mockDb, incomingEvent);

    expect(updateCalls).toHaveLength(1);
  });

  it("re-throws non-duplicate errors instead of silently swallowing them", async () => {
    selectResults.push([]);
    selectResults.push([]);
    insertImpl = () => Promise.reject({ code: "ER_NO_SUCH_TABLE", errno: 1146 });

    await expect(upsertEventWithDb(mockDb, incomingEvent)).rejects.toMatchObject({
      code: "ER_NO_SUCH_TABLE",
    });
    expect(updateCalls).toHaveLength(0);
  });

  it("bails when the race winner has been deleted between failure and re-fetch", async () => {
    selectResults.push([]); // pre-INSERT canonicalKey
    selectResults.push([]); // pre-INSERT venueDateKey
    insertImpl = () => Promise.reject({ code: "ER_DUP_ENTRY" });
    selectResults.push([]); // post-failure canonicalKey → empty (deleted)
    selectResults.push([]); // post-failure venueDateKey → empty

    await upsertEventWithDb(mockDb, incomingEvent);

    expect(updateCalls).toHaveLength(0);
  });

  it("warns when venueDateKey-only match has a different canonicalKey (defensive)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    selectResults.push([]); // canonicalKey lookup → miss
    const otherEvent = makeRow({
      id: 5,
      title: "Bachata Class",
      canonicalKey: "different-canonical-key",
    });
    selectResults.push([otherEvent]); // venueDateKey lookup → hit, different event

    await upsertEventWithDb(mockDb, incomingEvent);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("venueDateKey-only match"),
    );
    // Merge still proceeds — that's the documented behaviour.
    expect(updateCalls).toHaveLength(1);
    warnSpy.mockRestore();
  });
});
