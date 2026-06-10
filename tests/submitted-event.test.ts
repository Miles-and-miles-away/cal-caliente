import { beforeEach, describe, expect, it } from "vitest";
import {
  DuplicateEventError,
  SUBMISSION_SOURCE_URL,
  computeCanonicalKey,
  computeVenueDateKey,
  getOrCreateSubmissionSourceWithDb,
  insertSubmittedEventWithDb,
  type SubmittedEventInput,
} from "../server/db";

// Mock Drizzle's chained query API (same approach as upsert-event.test.ts):
//   db.select(...).from(...).where(...).limit(1) → Promise<rows from queue>
//   db.insert(...).values(...)                    → records values, resolves/throws
const selectResults: any[][] = [];
const insertValues: any[] = [];
let insertImpl: () => Promise<any> = () => Promise.resolve([{ insertId: 0 }]);

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(selectResults.shift() ?? []),
      }),
    }),
  }),
  insert: () => ({
    values: (v: any) => {
      insertValues.push(v);
      return insertImpl();
    },
  }),
} as any;

beforeEach(() => {
  selectResults.length = 0;
  insertValues.length = 0;
  insertImpl = () => Promise.resolve([{ insertId: 0 }]);
});

const dupError = () => {
  const e: any = new Error("Duplicate entry");
  e.code = "ER_DUP_ENTRY";
  return e;
};

describe("getOrCreateSubmissionSourceWithDb", () => {
  it("returns the existing sentinel source id without inserting", async () => {
    selectResults.push([{ id: 99 }]);
    const id = await getOrCreateSubmissionSourceWithDb(mockDb);
    expect(id).toBe(99);
    expect(insertValues).toHaveLength(0);
  });

  it("creates the sentinel source when missing (inactive, internal URL)", async () => {
    selectResults.push([]);            // first lookup: not found
    selectResults.push([{ id: 42 }]);  // re-fetch after insert
    const id = await getOrCreateSubmissionSourceWithDb(mockDb);
    expect(id).toBe(42);
    expect(insertValues).toHaveLength(1);
    expect(insertValues[0]).toEqual(
      expect.objectContaining({
        url: SUBMISSION_SOURCE_URL,
        sourceType: "custom",
        isActive: false,
        isUserAdded: false,
      }),
    );
  });
});

describe("insertSubmittedEventWithDb", () => {
  const input: SubmittedEventInput = {
    title: "Saturday Salsa Social",
    startAt: "2026-07-10T19:00:00+09:00",
    venueName: "Club Salud",
    description: "Come dance",
    danceStyle: "salsa",
    eventType: "social",
    city: "Tokyo",
  };

  it("inserts with the sentinel sourceId, user attribution, dedup keys, and isVerified=false", async () => {
    selectResults.push([{ id: 99 }]); // existing submission source
    insertImpl = () => Promise.resolve([{ insertId: 321 }]);

    const result = await insertSubmittedEventWithDb(mockDb, input, 7);

    expect(result).toEqual({ id: 321 });
    expect(insertValues).toHaveLength(1);
    const row = insertValues[0];
    expect(row.sourceId).toBe(99);
    expect(row.submittedByUserId).toBe(7);
    expect(row.isVerified).toBe(false);
    expect(row.title).toBe("Saturday Salsa Social");
    expect(row.startAt).toBeInstanceOf(Date);
    // Keys are computed with the shared helpers so submissions dedup like scraped events.
    expect(row.canonicalKey).toBe(computeCanonicalKey(input.title, new Date(input.startAt)));
    expect(row.venueDateKey).toBe(computeVenueDateKey(input.venueName, new Date(input.startAt)));
  });

  it("translates a duplicate-key error into DuplicateEventError", async () => {
    selectResults.push([{ id: 99 }]);
    insertImpl = () => Promise.reject(dupError());
    await expect(insertSubmittedEventWithDb(mockDb, input, 7)).rejects.toBeInstanceOf(
      DuplicateEventError,
    );
  });

  it("rethrows non-duplicate insert errors as-is", async () => {
    selectResults.push([{ id: 99 }]);
    insertImpl = () => Promise.reject(new Error("connection reset"));
    await expect(insertSubmittedEventWithDb(mockDb, input, 7)).rejects.toThrow(
      /connection reset/,
    );
  });
});
