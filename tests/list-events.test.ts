import { beforeEach, describe, expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { listEventsWithDb } from "../server/db";
import { events } from "../drizzle/schema";
import { API_DEFAULT_PAGE_SIZE, API_MAX_PAGE_SIZE } from "../shared/constants";

// Mock the select chain, capturing the query-shaping arguments so the filter
// logic can be asserted against real SQL. The captured drizzle condition is
// serialized with MySqlDialect — the same dialect the real connection uses —
// so these tests exercise exactly the WHERE clause production would run.
let captured: {
  projection?: Record<string, unknown>;
  where?: any;
  orderBy?: any[];
  limit?: number;
  offset?: number;
};

const mockDb = {
  select: (projection: Record<string, unknown>) => {
    captured.projection = projection;
    return {
      from: () => ({
        where: (cond: any) => {
          captured.where = cond;
          return {
            orderBy: (...cols: any[]) => {
              captured.orderBy = cols;
              return {
                limit: (n: number) => {
                  captured.limit = n;
                  return {
                    offset: (n2: number) => {
                      captured.offset = n2;
                      return Promise.resolve([]);
                    },
                  };
                },
              };
            },
          };
        },
      }),
    };
  },
} as any;

const dialect = new MySqlDialect();
const whereSql = () => dialect.sqlToQuery(captured.where);

beforeEach(() => {
  captured = {};
});

describe("listEventsWithDb (filter building)", () => {
  it("always filters out cancelled events, even with no params", async () => {
    await listEventsWithDb(mockDb, {});
    const { sql, params } = whereSql();
    expect(sql).toBe("`events`.`isCancelled` = ?");
    expect(params).toEqual([false]);
  });

  it("filters by danceStyle and eventType when given", async () => {
    await listEventsWithDb(mockDb, { danceStyle: "salsa", eventType: "social" });
    const { sql, params } = whereSql();
    expect(sql).toContain("`events`.`danceStyle` = ?");
    expect(sql).toContain("`events`.`eventType` = ?");
    expect(params).toEqual([false, "salsa", "social"]);
  });

  it('treats the "all" sentinel as no filter for danceStyle and eventType', async () => {
    await listEventsWithDb(mockDb, { danceStyle: "all", eventType: "all" });
    const { sql } = whereSql();
    expect(sql).not.toContain("danceStyle");
    expect(sql).not.toContain("eventType");
  });

  it("applies the date range as inclusive startAt bounds (gte/lte)", async () => {
    await listEventsWithDb(mockDb, {
      startDate: "2026-07-01T00:00:00+09:00",
      endDate: "2026-07-31T23:59:59+09:00",
    });
    const { sql, params } = whereSql();
    expect(sql).toContain("`events`.`startAt` >= ?");
    expect(sql).toContain("`events`.`startAt` <= ?");
    // Bounds serialize as UTC MySQL datetimes (JST +09:00 shifted back 9h).
    expect(params[1]).toBe("2026-06-30 15:00:00.000");
    expect(params[2]).toBe("2026-07-31 14:59:59.000");
  });

  it("searches title, venueName, organizer, and city with one OR group", async () => {
    await listEventsWithDb(mockDb, { search: "salsa" });
    const { sql, params } = whereSql();
    expect(sql).toContain("`events`.`title` like ?");
    expect(sql).toContain("`events`.`venueName` like ?");
    expect(sql).toContain("`events`.`organizer` like ?");
    expect(sql).toContain("`events`.`city` like ?");
    expect(sql.split(" or ")).toHaveLength(4);
    expect(params).toEqual([false, "%salsa%", "%salsa%", "%salsa%", "%salsa%"]);
  });

  it("escapes LIKE wildcards in the search term", async () => {
    // A search for "50%off" must match that literal string, not use % as a
    // wildcard; same for _ and the escape char itself.
    await listEventsWithDb(mockDb, { search: "50%off_\\x" });
    const { params } = whereSql();
    expect(params[1]).toBe("%50\\%off\\_\\\\x%");
  });

  it("clamps limit to API_MAX_PAGE_SIZE and defaults sensibly", async () => {
    await listEventsWithDb(mockDb, { limit: API_MAX_PAGE_SIZE + 500 });
    expect(captured.limit).toBe(API_MAX_PAGE_SIZE);

    await listEventsWithDb(mockDb, {});
    expect(captured.limit).toBe(API_DEFAULT_PAGE_SIZE);
    expect(captured.offset).toBe(0);

    await listEventsWithDb(mockDb, { limit: 5, offset: 20 });
    expect(captured.limit).toBe(5);
    expect(captured.offset).toBe(20);
  });

  it("orders by startAt then id so pagination is deterministic on ties", async () => {
    await listEventsWithDb(mockDb, {});
    expect(captured.orderBy).toEqual([events.startAt, events.id]);
  });

  it("projects only list-view columns (no heavy text fields)", async () => {
    await listEventsWithDb(mockDb, {});
    const cols = Object.keys(captured.projection!);
    expect(cols).toEqual(
      expect.arrayContaining(["id", "title", "startAt", "venueName", "latitude", "longitude"]),
    );
    for (const heavy of ["description", "venueAddress", "imageUrl", "sourceUrl"]) {
      expect(cols).not.toContain(heavy);
    }
  });
});
