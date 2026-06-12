import { beforeEach, describe, expect, it } from "vitest";
import { deleteSourceWithDb, toggleSourceWithDb } from "../server/db";

// Mock Drizzle's chained query API (same approach as submitted-event.test.ts):
//   db.select().from().where().limit(1)  → Promise<rows from queue>
//   db.update().set(v).where()           → records v
//   db.delete().where()                  → records the call
const selectResults: any[][] = [];
const updateSets: any[] = [];
let deleteCalls = 0;

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(selectResults.shift() ?? []),
      }),
    }),
  }),
  update: () => ({
    set: (v: any) => {
      updateSets.push(v);
      return { where: () => Promise.resolve() };
    },
  }),
  delete: () => {
    deleteCalls++;
    return { where: () => Promise.resolve() };
  },
} as any;

beforeEach(() => {
  selectResults.length = 0;
  updateSets.length = 0;
  deleteCalls = 0;
});

const user = { userId: 7, isAdmin: false };
const admin = { userId: 1, isAdmin: true };

// A source another user added, and a seeded default source (null owner).
const userSource = { id: 10, addedByUserId: 7, isUserAdded: true };
const otherUserSource = { id: 11, addedByUserId: 8, isUserAdded: true };
const seededSource = { id: 12, addedByUserId: null, isUserAdded: false };

describe("toggleSourceWithDb (ownership gate)", () => {
  it("returns not_found for a missing source and writes nothing", async () => {
    selectResults.push([]);
    await expect(toggleSourceWithDb(mockDb, 99, false, user)).resolves.toBe("not_found");
    expect(updateSets).toHaveLength(0);
  });

  it("lets the owner toggle their own source", async () => {
    selectResults.push([userSource]);
    await expect(toggleSourceWithDb(mockDb, 10, false, user)).resolves.toBe("ok");
    expect(updateSets).toEqual([{ isActive: false }]);
  });

  it("forbids toggling another user's source", async () => {
    selectResults.push([otherUserSource]);
    await expect(toggleSourceWithDb(mockDb, 11, false, user)).resolves.toBe("forbidden");
    expect(updateSets).toHaveLength(0);
  });

  it("forbids a normal user toggling a seeded source (null owner ≠ ownership)", async () => {
    // Regression guard: addedByUserId NULL must never compare equal to any
    // userId — a loose == or missing null check would let users disable the
    // default scraper sources for everyone.
    selectResults.push([seededSource]);
    await expect(toggleSourceWithDb(mockDb, 12, false, user)).resolves.toBe("forbidden");
    expect(updateSets).toHaveLength(0);
  });

  it("lets an admin toggle any source, including seeded ones", async () => {
    selectResults.push([seededSource]);
    await expect(toggleSourceWithDb(mockDb, 12, false, admin)).resolves.toBe("ok");
    expect(updateSets).toEqual([{ isActive: false }]);
  });
});

describe("deleteSourceWithDb (ownership gate + seeded veto)", () => {
  it("returns not_found for a missing source and deletes nothing", async () => {
    selectResults.push([]);
    await expect(deleteSourceWithDb(mockDb, 99, admin)).resolves.toBe("not_found");
    expect(deleteCalls).toBe(0);
  });

  it("lets the owner delete their own user-added source", async () => {
    selectResults.push([userSource]);
    await expect(deleteSourceWithDb(mockDb, 10, user)).resolves.toBe("ok");
    expect(deleteCalls).toBe(1);
  });

  it("forbids deleting another user's source", async () => {
    selectResults.push([otherUserSource]);
    await expect(deleteSourceWithDb(mockDb, 11, user)).resolves.toBe("forbidden");
    expect(deleteCalls).toBe(0);
  });

  it("forbids even an admin deleting a seeded source (it would just re-seed)", async () => {
    selectResults.push([seededSource]);
    await expect(deleteSourceWithDb(mockDb, 12, admin)).resolves.toBe("forbidden");
    expect(deleteCalls).toBe(0);
  });

  it("lets an admin delete a user-added source they don't own", async () => {
    selectResults.push([otherUserSource]);
    await expect(deleteSourceWithDb(mockDb, 11, admin)).resolves.toBe("ok");
    expect(deleteCalls).toBe(1);
  });
});
