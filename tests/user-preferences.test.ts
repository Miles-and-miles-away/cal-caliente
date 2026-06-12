import { beforeEach, describe, expect, it } from "vitest";
import { upsertUserPreferencesWithDb } from "../server/db";

// Mock Drizzle's chained query API (same approach as submitted-event.test.ts).
const selectResults: any[][] = [];
const updateSets: any[] = [];
const insertValues: any[] = [];

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
  insert: () => ({
    values: (v: any) => {
      insertValues.push(v);
      return Promise.resolve();
    },
  }),
} as any;

beforeEach(() => {
  selectResults.length = 0;
  updateSets.length = 0;
  insertValues.length = 0;
});

describe("upsertUserPreferencesWithDb (mass-assignment allowlist)", () => {
  it("updates the existing row with allowlisted fields only", async () => {
    selectResults.push([{ userId: 7, city: "Osaka" }]); // existing row
    await upsertUserPreferencesWithDb(mockDb, 7, { city: "Tokyo", theme: "dark" });
    expect(updateSets).toEqual([{ city: "Tokyo", theme: "dark" }]);
    expect(insertValues).toHaveLength(0);
  });

  it("inserts a new row (keyed by userId) when none exists", async () => {
    selectResults.push([]); // no existing row
    await upsertUserPreferencesWithDb(mockDb, 7, { city: "Tokyo" });
    expect(insertValues).toEqual([{ userId: 7, city: "Tokyo" }]);
    expect(updateSets).toHaveLength(0);
  });

  it("silently drops non-allowlisted fields (defense against mass assignment)", async () => {
    // The router's strict schema should already reject these, but the db layer
    // must hold on its own: a privileged column must never be writable through
    // a preferences payload.
    selectResults.push([{ userId: 7 }]);
    await upsertUserPreferencesWithDb(mockDb, 7, {
      city: "Tokyo",
      role: "admin",
      userId: 999,
      isVerified: true,
    });
    expect(updateSets).toEqual([{ city: "Tokyo" }]);
  });

  it("writes nothing for an empty payload (drizzle's .set({}) would throw)", async () => {
    // `preferencesUpsertInput` is fully partial, so `{}` is a legal request.
    selectResults.push([{ userId: 7 }]);
    await upsertUserPreferencesWithDb(mockDb, 7, {});
    expect(updateSets).toHaveLength(0);
    expect(insertValues).toHaveLength(0);
  });

  it("writes nothing when every provided field is non-allowlisted", async () => {
    selectResults.push([{ userId: 7 }]);
    await upsertUserPreferencesWithDb(mockDb, 7, { role: "admin" });
    expect(updateSets).toHaveLength(0);
    expect(insertValues).toHaveLength(0);
  });

  it("passes falsy-but-meaningful values through (false, 0, empty string)", async () => {
    selectResults.push([{ userId: 7 }]);
    await upsertUserPreferencesWithDb(mockDb, 7, {
      notificationsEnabled: false,
      maxDistanceKm: 0,
      city: "",
    });
    expect(updateSets).toEqual([{ notificationsEnabled: false, maxDistanceKm: 0, city: "" }]);
  });
});
