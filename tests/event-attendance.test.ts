import { beforeEach, describe, expect, it } from "vitest";
import {
  getEventAttendanceWithDb,
  getEventAttendanceCountsWithDb,
  setEventAttendanceWithDb,
} from "../server/db";

// Mock Drizzle's chained query API for the attendance helpers:
//   db.select(...).from(...).where(...).groupBy(...) → count rows
//   db.select(...).from(...).where(...).limit(1)     → caller's own row
//   db.delete(...).where(...)                        → clear RSVP
//   db.insert(...).values(...).onDuplicateKeyUpdate(...) → upsert RSVP
let groupByResult: any[] = [];
let limitResult: any[] = [];
const insertValues: any[] = [];
const updateSets: any[] = [];
let deleteCalled = false;

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        groupBy: () => Promise.resolve(groupByResult),
        limit: () => Promise.resolve(limitResult),
      }),
    }),
  }),
  delete: () => ({
    where: () => {
      deleteCalled = true;
      return Promise.resolve();
    },
  }),
  insert: () => ({
    values: (v: any) => {
      insertValues.push(v);
      return {
        onDuplicateKeyUpdate: (arg: any) => {
          updateSets.push(arg.set);
          return Promise.resolve();
        },
      };
    },
  }),
} as any;

beforeEach(() => {
  groupByResult = [];
  limitResult = [];
  insertValues.length = 0;
  updateSets.length = 0;
  deleteCalled = false;
});

describe("getEventAttendanceWithDb", () => {
  it("aggregates interested/going counts and resolves the caller's status", async () => {
    groupByResult = [
      { status: "interested", c: 3 },
      { status: "going", c: 5 },
    ];
    limitResult = [{ status: "going" }];
    const result = await getEventAttendanceWithDb(mockDb, 42, 1);
    expect(result).toEqual({ interested: 3, going: 5, myStatus: "going" });
  });

  it("leaves myStatus null when no userId is supplied (public read)", async () => {
    groupByResult = [{ status: "going", c: 2 }];
    const result = await getEventAttendanceWithDb(mockDb, 42);
    expect(result).toEqual({ interested: 0, going: 2, myStatus: null });
  });

  it("returns zeroes for an event with no attendance rows", async () => {
    const result = await getEventAttendanceWithDb(mockDb, 99, 1);
    expect(result).toEqual({ interested: 0, going: 0, myStatus: null });
  });

  it("coerces string counts from the driver to numbers", async () => {
    groupByResult = [{ status: "going", c: "7" }];
    const result = await getEventAttendanceWithDb(mockDb, 42);
    expect(result.going).toBe(7);
  });
});

describe("setEventAttendanceWithDb", () => {
  it("upserts the status onto the unique (user,event) key", async () => {
    await setEventAttendanceWithDb(mockDb, 1, 7, "going");
    expect(deleteCalled).toBe(false);
    expect(insertValues).toEqual([{ userId: 1, eventId: 7, status: "going" }]);
    expect(updateSets).toEqual([{ status: "going" }]);
  });

  it("deletes the row (no insert) when status is null", async () => {
    await setEventAttendanceWithDb(mockDb, 1, 7, null);
    expect(deleteCalled).toBe(true);
    expect(insertValues).toHaveLength(0);
  });
});

describe("getEventAttendanceCountsWithDb", () => {
  it("returns an empty map for an empty id list (no query)", async () => {
    const result = await getEventAttendanceCountsWithDb(mockDb, []);
    expect(result).toEqual({});
  });

  it("groups counts by event and status, defaulting missing statuses to 0", async () => {
    groupByResult = [
      { eventId: 1, status: "going", c: 3 },
      { eventId: 1, status: "interested", c: 1 },
      { eventId: 2, status: "going", c: 5 },
    ];
    const result = await getEventAttendanceCountsWithDb(mockDb, [1, 2]);
    expect(result).toEqual({
      1: { interested: 1, going: 3 },
      2: { interested: 0, going: 5 },
    });
  });

  it("coerces string counts from the driver to numbers", async () => {
    groupByResult = [{ eventId: 9, status: "interested", c: "4" }];
    const result = await getEventAttendanceCountsWithDb(mockDb, [9]);
    expect(result[9]).toEqual({ interested: 4, going: 0 });
  });
});
