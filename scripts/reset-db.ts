/**
 * reset-db.ts — clean-slate database rebuild + schema verification.
 *
 * WHY THIS EXISTS
 * ---------------
 * `drizzle-kit migrate` records a migration in `__drizzle_migrations` as soon
 * as it begins applying it. We have repeatedly hit states (partial applies,
 * rewritten migration history) where the journal says a migration is "applied"
 * but some of its statements never landed — e.g. a column or unique index is
 * silently missing. Because the journal claims success, a re-run of `migrate`
 * is a no-op and will NOT self-heal, so the database stays subtly broken
 * (500s on `events.list`, scrapes crashing, etc.).
 *
 * Since there are no real users yet, the reliable cure is a clean slate:
 *   1. drop every table (this also drops `__drizzle_migrations`, so there is
 *      no stale journal left to lie about what's applied),
 *   2. replay every migration from 0000,
 *   3. VERIFY the resulting live schema against drizzle's own snapshot
 *      (the canonical end-state) before trusting it — tables, columns, and
 *      indexes. Exit non-zero on any drift so this fails LOUDLY.
 *
 * After a reset the database is empty of data. Restart the API server
 * (`npm run dev:server`) — it re-seeds the default sources and the scraper
 * scheduler repopulates events on its first cycle.
 *
 * USAGE
 * -----
 *   npm run db:reset -- --yes           # destructive, no prompt (Manus / CI)
 *   npm run db:reset                    # prompts for confirmation (TTY only)
 *   npm run db:reset -- --verify-only   # no drop/migrate — just check schema↔snapshot
 *
 * Honors DATABASE_URL from the environment (Manus-injected) or .env. dotenv
 * does not override already-set env vars, so platform-injected values win.
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

const args = new Set(process.argv.slice(2));
const SKIP_PROMPT =
  args.has("--yes") || args.has("-y") || process.env.RESET_DB_CONFIRM === "1";
const VERIFY_ONLY = args.has("--verify-only");

const DRIZZLE_DIR = path.resolve(process.cwd(), "drizzle");
const META_DIR = path.join(DRIZZLE_DIR, "meta");

type ExpectedIndex = { name: string; columns: string[]; isUnique: boolean };
type ExpectedTable = { columns: string[]; indexes: ExpectedIndex[] };
type ExpectedSchema = { tables: Record<string, ExpectedTable>; migrationCount: number };

// We connect with the full DATABASE_URL string (preserves SSL/query params), so
// this only extracts the database NAME for information_schema queries — plus
// host/port for the confirmation banner.
function parseDbUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`DATABASE_URL is not a valid URL: ${raw}`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new Error("DATABASE_URL has no database name in its path");
  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 3306,
    database,
  };
}

// ── Expected schema, straight from drizzle's own latest snapshot ──────────────
function loadExpectedSchema(): ExpectedSchema {
  const journalPath = path.join(META_DIR, "_journal.json");
  if (!existsSync(journalPath)) {
    throw new Error(`Cannot find ${journalPath} — run from the repo root.`);
  }
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const entries: { idx: number }[] = journal.entries ?? [];
  if (entries.length === 0) throw new Error("Migration journal has no entries");

  const latestIdx = Math.max(...entries.map((e) => e.idx));
  const snapName = `${String(latestIdx).padStart(4, "0")}_snapshot.json`;
  const snapPath = path.join(META_DIR, snapName);
  if (!existsSync(snapPath)) {
    throw new Error(`Expected snapshot ${snapName} not found in ${META_DIR}`);
  }
  const snap = JSON.parse(readFileSync(snapPath, "utf8"));

  const tables: Record<string, ExpectedTable> = {};
  for (const [tableName, t] of Object.entries<any>(snap.tables ?? {})) {
    const columns = Object.values<any>(t.columns ?? {}).map((c) => c.name);
    const indexes: ExpectedIndex[] = [
      ...Object.values<any>(t.indexes ?? {}).map((i) => ({
        name: i.name,
        columns: i.columns,
        isUnique: !!i.isUnique,
      })),
      // `.unique()` constraints also materialize as (unique) indexes in MySQL.
      ...Object.values<any>(t.uniqueConstraints ?? {}).map((u) => ({
        name: u.name,
        columns: u.columns,
        isUnique: true,
      })),
    ];
    tables[tableName] = { columns, indexes };
  }

  return { tables, migrationCount: entries.length };
}

// ── Drop every table in the target database ───────────────────────────────────
async function dropAllTables(conn: mysql.Connection, database: string) {
  const [rows] = await conn.query<any[]>(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
    [database],
  );
  const tables = rows.map((r) => r.t as string);
  if (tables.length === 0) {
    console.log("  Database is already empty — nothing to drop.");
    return;
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of tables) {
    if (!/^[A-Za-z0-9_$]+$/.test(t)) {
      throw new Error(`Refusing to drop oddly-named table: ${t}`);
    }
    await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log(`  Dropped ${tables.length} table(s): ${tables.join(", ")}`);
}

// ── Verify the live schema matches the snapshot ────────────────────────────────
async function verifySchema(
  conn: mysql.Connection,
  database: string,
  expected: ExpectedSchema,
): Promise<string[]> {
  const problems: string[] = [];

  const [tblRows] = await conn.query<any[]>(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
    [database],
  );
  const actualTables = new Set(tblRows.map((r) => r.t as string));

  for (const [table, spec] of Object.entries(expected.tables)) {
    if (!actualTables.has(table)) {
      problems.push(`MISSING TABLE: ${table}`);
      continue;
    }

    const [colRows] = await conn.query<any[]>(
      "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [database, table],
    );
    const actualCols = new Set(colRows.map((r) => r.c as string));
    for (const col of spec.columns) {
      if (!actualCols.has(col)) problems.push(`MISSING COLUMN: ${table}.${col}`);
    }

    const [idxRows] = await conn.query<any[]>(
      `SELECT INDEX_NAME AS name, MIN(NON_UNIQUE) AS nonUnique
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        GROUP BY INDEX_NAME`,
      [database, table],
    );
    const actualIdx = new Map(
      idxRows.map((r) => [r.name as string, Number(r.nonUnique) === 0]),
    );
    for (const idx of spec.indexes) {
      if (!actualIdx.has(idx.name)) {
        problems.push(`MISSING INDEX: ${table}.${idx.name}`);
      } else if (idx.isUnique && actualIdx.get(idx.name) !== true) {
        problems.push(`INDEX NOT UNIQUE (expected unique): ${table}.${idx.name}`);
      }
    }
  }

  // The whole point: confirm the journal actually has every migration recorded.
  try {
    const [mrows] = await conn.query<any[]>(
      "SELECT COUNT(*) AS n FROM __drizzle_migrations",
    );
    const applied = Number(mrows[0]?.n ?? 0);
    if (applied !== expected.migrationCount) {
      problems.push(
        `MIGRATION COUNT MISMATCH: __drizzle_migrations has ${applied}, journal expects ${expected.migrationCount}`,
      );
    }
  } catch {
    problems.push("MISSING TABLE: __drizzle_migrations (migrations never ran)");
  }

  return problems;
}

async function confirm(target: { host: string; port: number; database: string }) {
  if (SKIP_PROMPT) return true;
  if (!process.stdin.isTTY) {
    console.error(
      "\nRefusing to drop data non-interactively without confirmation.\n" +
        "Re-run with:  npm run db:reset -- --yes",
    );
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((res) =>
    rl.question(
      `\n⚠️  This DROPS ALL TABLES in "${target.database}" @ ${target.host}:${target.port} ` +
        `and rebuilds from migration 0000.\n` +
        `Type the database name to confirm: `,
      res,
    ),
  );
  rl.close();
  return answer.trim() === target.database;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set (env or .env). Aborting.");
    process.exit(1);
  }
  const target = parseDbUrl(dbUrl);
  const expected = loadExpectedSchema();

  console.log(`Target: ${target.database} @ ${target.host}:${target.port}`);
  console.log(
    `Snapshot expects ${Object.keys(expected.tables).length} tables, ` +
      `${expected.migrationCount} migrations.`,
  );

  if (!VERIFY_ONLY) {
    if (!(await confirm(target))) {
      console.error("Aborted — confirmation did not match.");
      process.exit(1);
    }

    console.log("\n[1/3] Dropping all tables…");
    // Connect with the FULL DATABASE_URL string (not decomposed host/user/etc.)
    // so any ?ssl=… / TLS query params are honored — identical to how the app
    // connects via drizzle(process.env.DATABASE_URL). Decomposing the URL drops
    // those params and fails against TLS-requiring databases (e.g. TiDB Cloud).
    const conn = await mysql.createConnection(dbUrl);
    try {
      await dropAllTables(conn, target.database);
    } finally {
      await conn.end();
    }

    console.log("\n[2/3] Running migrations from 0000…");
    // drizzle.config.ts reads DATABASE_URL from the environment; inherit it.
    execSync("npx drizzle-kit migrate", { stdio: "inherit", env: process.env });
  } else {
    console.log("\n--verify-only: skipping drop + migrate.");
  }

  console.log("\n[3/3] Verifying live schema against snapshot…");
  // Full URL string (see note above) — preserves SSL/TLS params for the verify
  // connection too.
  const conn = await mysql.createConnection(dbUrl);
  let problems: string[];
  try {
    problems = await verifySchema(conn, target.database, expected);
  } finally {
    await conn.end();
  }

  if (problems.length > 0) {
    console.error(`\n❌ Schema verification FAILED (${problems.length} issue(s)):`);
    for (const p of problems) console.error(`   - ${p}`);
    console.error(
      "\nThe migration journal does not match the live schema. Do NOT trust this database.",
    );
    process.exit(1);
  }

  console.log("\n✅ Schema verified: all tables, columns, and indexes match the snapshot.");
  if (!VERIFY_ONLY) {
    console.log(
      "Database is empty. Restart the API server (npm run dev:server) to re-seed " +
        "sources and let the scraper repopulate events.",
    );
  }
}

main().catch((err) => {
  console.error("reset-db failed:", err);
  process.exit(1);
});
