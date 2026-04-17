import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
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
    // Check if events already exist
    const [countResult] = await db.execute(sql`SELECT COUNT(*) as cnt FROM events`) as any;
    const eventCount = countResult?.[0]?.cnt ?? 0;
    if (eventCount > 0) {
      console.log(`[Seed] Database already has ${eventCount} events, skipping seed`);
      return;
    }

    console.log("[Seed] Seeding database with demo events...");

    // Seed default sources
    const sources = [
      { name: "Tokyo Salsa Community", url: "https://facebook.com/tokyosalsa", sourceType: "facebook", region: "japan" },
      { name: "Osaka Latin Dance", url: "https://facebook.com/osakalatindance", sourceType: "facebook", region: "japan" },
      { name: "Nagoya Bachata Club", url: "https://instagram.com/nagoyabachata", sourceType: "instagram", region: "japan" },
      { name: "Fukuoka Salsa", url: "https://fukuokasalsa.jp", sourceType: "html", region: "japan" },
      { name: "Yokohama Dance Studio", url: "https://yokohamadance.com", sourceType: "html", region: "japan" },
      { name: "Kobe Latin Nights", url: "https://facebook.com/kobelatinnights", sourceType: "facebook", region: "japan" },
      { name: "Sapporo Salsa", url: "https://sapporosalsa.jp", sourceType: "html", region: "japan" },
      { name: "Kyoto Dance Events", url: "https://kyotodance.jp/events.rss", sourceType: "rss", region: "japan" },
      { name: "Japan Salsa Congress", url: "https://japansalsacongress.com", sourceType: "html", region: "japan" },
      { name: "Latin Dance Japan", url: "https://instagram.com/latindancejapan", sourceType: "instagram", region: "japan" },
    ];

    for (const src of sources) {
      await db.execute(sql`INSERT IGNORE INTO event_sources (name, url, sourceType, region, isActive, isUserAdded) VALUES (${src.name}, ${src.url}, ${src.sourceType}, ${src.region}, true, false)`);
    }

    // Seed demo events
    const now = new Date();
    const demoEvents = [
      { title: "Tokyo Salsa Social Night", danceStyle: "salsa", eventType: "social", daysFromNow: 2, hour: 19, venue: "Club Salsa Tokyo", address: "Roppongi 3-14-5, Minato-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6625", lng: "139.7314", station: "Roppongi", price: "¥2,500", organizer: "Tokyo Salsa Community" },
      { title: "Bachata Sensual Workshop", danceStyle: "bachata", eventType: "workshop", daysFromNow: 3, hour: 14, venue: "Dance Studio Uno", address: "Shibuya 2-8-1, Shibuya-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6580", lng: "139.7016", station: "Shibuya", price: "¥3,000", organizer: "Bachata Japan" },
      { title: "Osaka Latin Party", danceStyle: "both", eventType: "social", daysFromNow: 5, hour: 20, venue: "Club Tropicana Osaka", address: "Shinsaibashi 1-5-2, Chuo-ku", city: "Osaka", prefecture: "Osaka", lat: "34.6723", lng: "135.5005", station: "Shinsaibashi", price: "¥2,000", organizer: "Osaka Latin Dance" },
      { title: "Nagoya Bachata Night", danceStyle: "bachata", eventType: "social", daysFromNow: 4, hour: 20, venue: "Dance Hall Nagoya", address: "Sakae 3-10-1, Naka-ku", city: "Nagoya", prefecture: "Aichi", lat: "35.1681", lng: "136.9084", station: "Sakae", price: "¥2,000", organizer: "Nagoya Bachata Club" },
      { title: "Fukuoka Salsa Festival", danceStyle: "salsa", eventType: "festival", daysFromNow: 14, hour: 12, venue: "Fukuoka Convention Center", address: "Hakata-ku Sekijomachi 2-1", city: "Fukuoka", prefecture: "Fukuoka", lat: "33.5902", lng: "130.4017", station: "Gofukumachi", price: "¥5,000 (day pass)", organizer: "Fukuoka Salsa" },
      { title: "Yokohama Salsa & Bachata Social", danceStyle: "both", eventType: "social", daysFromNow: 6, hour: 19, venue: "Bay Dance Studio", address: "Minato Mirai 2-3-1", city: "Yokohama", prefecture: "Kanagawa", lat: "35.4559", lng: "139.6325", station: "Minato Mirai", price: "¥2,500", organizer: "Yokohama Dance Studio" },
      { title: "Kobe Latin Night", danceStyle: "both", eventType: "social", daysFromNow: 7, hour: 20, venue: "Harbor Dance Kobe", address: "Chuo-ku Kitanagasa-dori 1-9-1", city: "Kobe", prefecture: "Hyogo", lat: "34.6901", lng: "135.1956", station: "Motomachi", price: "¥2,000", organizer: "Kobe Latin Nights" },
      { title: "Salsa On2 Masterclass", danceStyle: "salsa", eventType: "workshop", daysFromNow: 8, hour: 15, venue: "Studio R Tokyo", address: "Ebisu 1-5-3, Shibuya-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6467", lng: "139.7100", station: "Ebisu", price: "¥4,000", organizer: "Salsa Masters Japan" },
      { title: "Bachata Beginners Class", danceStyle: "bachata", eventType: "class", daysFromNow: 1, hour: 18, venue: "Dance Academy Shinjuku", address: "Shinjuku 3-1-24", city: "Tokyo", prefecture: "Tokyo", lat: "35.6896", lng: "139.7006", station: "Shinjuku", price: "¥1,500", organizer: "Dance Academy" },
      { title: "Osaka Salsa Congress 2026", danceStyle: "salsa", eventType: "festival", daysFromNow: 30, hour: 10, venue: "Osaka International Convention Center", address: "Nakanoshima 5-3-51, Kita-ku", city: "Osaka", prefecture: "Osaka", lat: "34.6937", lng: "135.4850", station: "Nakanoshima", price: "¥12,000 (3-day pass)", organizer: "Japan Salsa Congress" },
      { title: "Salsa Rueda Workshop", danceStyle: "salsa", eventType: "workshop", daysFromNow: 10, hour: 13, venue: "Latin Dance Studio", address: "Tenjin 2-4-11, Chuo-ku", city: "Fukuoka", prefecture: "Fukuoka", lat: "33.5904", lng: "130.3990", station: "Tenjin", price: "¥2,500", organizer: "Fukuoka Salsa" },
      { title: "Tokyo Bachata Festival", danceStyle: "bachata", eventType: "festival", daysFromNow: 21, hour: 11, venue: "Shinagawa Prince Hotel", address: "Takanawa 4-10-30, Minato-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6285", lng: "139.7387", station: "Shinagawa", price: "¥8,000 (day pass)", organizer: "Bachata Japan" },
    ];

    for (const ev of demoEvents) {
      const startAt = new Date(now);
      startAt.setDate(startAt.getDate() + ev.daysFromNow);
      startAt.setHours(ev.hour, 0, 0, 0);

      const endAt = new Date(startAt);
      endAt.setHours(endAt.getHours() + 3);

      const desc = `Join us for ${ev.title}! A great opportunity to dance and meet fellow dancers in ${ev.city}.`;
      await db.execute(sql`INSERT INTO events (sourceId, title, description, danceStyle, eventType, startAt, endAt, venueName, venueAddress, city, prefecture, latitude, longitude, nearestStation, price, organizer, isVerified) VALUES (${1}, ${ev.title}, ${desc}, ${ev.danceStyle}, ${ev.eventType}, ${startAt}, ${endAt}, ${ev.venue}, ${ev.address}, ${ev.city}, ${ev.prefecture}, ${ev.lat}, ${ev.lng}, ${ev.station}, ${ev.price}, ${ev.organizer}, ${true})`);
    }

    console.log(`[Seed] Seeded ${sources.length} sources and ${demoEvents.length} events`);
  } catch (error) {
    console.error("[Seed] Error seeding database:", error);
  }
}

// ─── Server Startup ──────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const server = createServer(app);

  // CORS — reflect request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
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
