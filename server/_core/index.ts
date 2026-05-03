import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { corsMiddleware } from "./cors";
import { trpcRateLimit } from "./rate-limit";
import { getDb } from "../db";
import { startScheduler } from "../scraper";
import { sql } from "drizzle-orm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

async function seedDatabase() {
  const db = await getDb();
  if (!db) {
    console.warn("[Seed] Database not available, skipping seed");
    return;
  }

  try {
    // Seed sources only — events are populated by the scraper, not hardcoded.
    // This is intentional: the previous version seeded 30 fake demo events
    // that masked whether the scraper was actually working. If you need to
    // reseed sources, this is idempotent (INSERT IGNORE on the URL unique key).
    const sources = [
      // SalsaVida per-city "guide" pages list ~30 days of upcoming events
      // grouped by date. The /events/<country>/ landing pages are curated
      // (~9 events) — the /guides/<country>/<city>/ pages are the comprehensive
      // listing and what we actually want to scrape. Tokyo alone is ~208
      // events / month; six cities give us several hundred to a thousand.
      { name: "SalsaVida Tokyo", url: "https://www.salsavida.com/guides/japan/tokyo/", sourceType: "html", region: "japan" },
      { name: "SalsaVida Osaka", url: "https://www.salsavida.com/guides/japan/osaka/", sourceType: "html", region: "japan" },
      { name: "SalsaVida Fukuoka", url: "https://www.salsavida.com/guides/japan/fukuoka/", sourceType: "html", region: "japan" },
      { name: "SalsaVida Kyoto", url: "https://www.salsavida.com/guides/japan/kyoto/", sourceType: "html", region: "japan" },
      { name: "SalsaVida Yokohama", url: "https://www.salsavida.com/guides/japan/yokohama/", sourceType: "html", region: "japan" },
      { name: "SalsaVida Okinawa", url: "https://www.salsavida.com/guides/japan/okinawa/", sourceType: "html", region: "japan" },
      // LatinDanceCalendar's Tokyo page is mostly JS-rendered, but the
      // "Featured deals" / "Festivals near here" sections are server-rendered
      // and surface 2-3 major festivals not in SalsaVida. Cross-source dedup
      // handles overlap with SalsaVida via canonicalKey.
      { name: "LatinDanceCalendar Tokyo", url: "https://latindancecalendar.com/events/location/tokyo-japan/", sourceType: "html", region: "japan" },
    ];

    for (const src of sources) {
      await db.execute(sql`INSERT IGNORE INTO event_sources (name, url, sourceType, region, isActive, isUserAdded) VALUES (${src.name}, ${src.url}, ${src.sourceType}, ${src.region}, true, false)`);
    }

    console.log(`[Seed] Ensured ${sources.length} default source(s); events will populate on next scrape cycle`);
  } catch (error) {
    console.error("[Seed] Error seeding database:", error);
  }
}

// ─── Server Startup ──────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Trust one reverse-proxy hop so rate-limit + logging see the real client IP
  // from X-Forwarded-For. `1` (not `true`) is what express-rate-limit asks for —
  // `true` would let any client spoof their IP and bypass the limit.
  app.set("trust proxy", 1);

  // CORS — allowlist enforced in ./cors.ts. Do not replace with reflection.
  app.use(corsMiddleware);

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Rate limit applied only to tRPC routes — health/OAuth endpoints have their
  // own characteristics (health is polled, OAuth has its own flow control).
  app.use(
    "/api/trpc",
    trpcRateLimit,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Seed database and start scraper scheduler
  await seedDatabase();
  startScheduler();

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
