import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { corsMiddleware } from "./cors";
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
      { name: "Tokyo Zouk Community", url: "https://facebook.com/tokyozouk", sourceType: "facebook", region: "japan" },
      { name: "Kizomba Tokyo", url: "https://instagram.com/kizombatokyo", sourceType: "instagram", region: "japan" },
      { name: "Japan Tango Association", url: "https://tangojapan.org", sourceType: "html", region: "japan" },
    ];

    for (const src of sources) {
      await db.execute(sql`INSERT IGNORE INTO event_sources (name, url, sourceType, region, isActive, isUserAdded) VALUES (${src.name}, ${src.url}, ${src.sourceType}, ${src.region}, true, false)`);
    }

    const now = new Date();

    // Helper to create event dates relative to now
    const makeDate = (daysFromNow: number, hour: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + daysFromNow);
      d.setHours(hour, 0, 0, 0);
      return d;
    };

    // Comprehensive seed events: future events + past events (for history)
    const demoEvents = [
      // ── FUTURE EVENTS ──────────────────────────────────────────────────
      // Salsa
      { title: "Tokyo Salsa Social Night", danceStyle: "salsa", eventType: "social", daysFromNow: 2, hour: 19, venue: "Club Salsa Tokyo", address: "Roppongi 3-14-5, Minato-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6625", lng: "139.7314", station: "Roppongi", price: "¥2,500", organizer: "Tokyo Salsa Community" },
      { title: "Salsa On2 Masterclass", danceStyle: "salsa", eventType: "workshop", daysFromNow: 8, hour: 15, venue: "Studio R Tokyo", address: "Ebisu 1-5-3, Shibuya-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6467", lng: "139.7100", station: "Ebisu", price: "¥4,000", organizer: "Salsa Masters Japan" },
      { title: "Salsa Rueda Workshop", danceStyle: "salsa", eventType: "workshop", daysFromNow: 10, hour: 13, venue: "Latin Dance Studio", address: "Tenjin 2-4-11, Chuo-ku", city: "Fukuoka", prefecture: "Fukuoka", lat: "33.5904", lng: "130.3990", station: "Tenjin", price: "¥2,500", organizer: "Fukuoka Salsa" },
      { title: "Osaka Salsa Congress 2026", danceStyle: "salsa", eventType: "congress", daysFromNow: 30, hour: 10, venue: "Osaka International Convention Center", address: "Nakanoshima 5-3-51, Kita-ku", city: "Osaka", prefecture: "Osaka", lat: "34.6937", lng: "135.4850", station: "Nakanoshima", price: "¥12,000 (3-day pass)", organizer: "Japan Salsa Congress" },
      { title: "Fukuoka Salsa Festival", danceStyle: "salsa", eventType: "festival", daysFromNow: 14, hour: 12, venue: "Fukuoka Convention Center", address: "Hakata-ku Sekijomachi 2-1", city: "Fukuoka", prefecture: "Fukuoka", lat: "33.5902", lng: "130.4017", station: "Gofukumachi", price: "¥5,000 (day pass)", organizer: "Fukuoka Salsa" },

      // Bachata
      { title: "Bachata Sensual Workshop", danceStyle: "bachata", eventType: "workshop", daysFromNow: 3, hour: 14, venue: "Dance Studio Uno", address: "Shibuya 2-8-1, Shibuya-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6580", lng: "139.7016", station: "Shibuya", price: "¥3,000", organizer: "Bachata Japan" },
      { title: "Bachata Beginners Class", danceStyle: "bachata", eventType: "class", daysFromNow: 1, hour: 18, venue: "Dance Academy Shinjuku", address: "Shinjuku 3-1-24", city: "Tokyo", prefecture: "Tokyo", lat: "35.6896", lng: "139.7006", station: "Shinjuku", price: "¥1,500", organizer: "Dance Academy" },
      { title: "Nagoya Bachata Night", danceStyle: "bachata", eventType: "social", daysFromNow: 4, hour: 20, venue: "Dance Hall Nagoya", address: "Sakae 3-10-1, Naka-ku", city: "Nagoya", prefecture: "Aichi", lat: "35.1681", lng: "136.9084", station: "Sakae", price: "¥2,000", organizer: "Nagoya Bachata Club" },
      { title: "Tokyo Bachata Festival", danceStyle: "bachata", eventType: "festival", daysFromNow: 21, hour: 11, venue: "Shinagawa Prince Hotel", address: "Takanawa 4-10-30, Minato-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6285", lng: "139.7387", station: "Shinagawa", price: "¥8,000 (day pass)", organizer: "Bachata Japan" },

      // Zouk
      { title: "Brazilian Zouk Social", danceStyle: "zouk", eventType: "social", daysFromNow: 3, hour: 20, venue: "Zouk Lounge Shibuya", address: "Dogenzaka 2-16-8, Shibuya-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6590", lng: "139.6980", station: "Shibuya", price: "¥2,500", organizer: "Tokyo Zouk Community" },
      { title: "Zouk Fundamentals Workshop", danceStyle: "zouk", eventType: "workshop", daysFromNow: 9, hour: 14, venue: "Flow Dance Studio", address: "Jingumae 6-25-14, Shibuya-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6660", lng: "139.7070", station: "Harajuku", price: "¥3,500", organizer: "Tokyo Zouk Community" },

      // Kizomba
      { title: "Kizomba Night Tokyo", danceStyle: "kizomba", eventType: "social", daysFromNow: 5, hour: 21, venue: "Afro Beat Lounge", address: "Azabu-Juban 2-3-5, Minato-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6540", lng: "139.7370", station: "Azabu-Juban", price: "¥3,000", organizer: "Kizomba Tokyo" },
      { title: "Kizomba Bootcamp Osaka", danceStyle: "kizomba", eventType: "bootcamp", daysFromNow: 15, hour: 10, venue: "Dance Studio Namba", address: "Namba 3-7-18, Chuo-ku", city: "Osaka", prefecture: "Osaka", lat: "34.6627", lng: "135.5014", station: "Namba", price: "¥6,000", organizer: "Kizomba Japan" },

      // Merengue
      { title: "Merengue & Cumbia Fiesta", danceStyle: "merengue", eventType: "social", daysFromNow: 6, hour: 19, venue: "Latino Bar Ikebukuro", address: "Nishi-Ikebukuro 1-12-1", city: "Tokyo", prefecture: "Tokyo", lat: "35.7295", lng: "139.7109", station: "Ikebukuro", price: "¥2,000", organizer: "Latin Vibes Tokyo" },

      // Cha-Cha-Cha
      { title: "Cha-Cha-Cha Technique Class", danceStyle: "cha-cha-cha", eventType: "class", daysFromNow: 5, hour: 19, venue: "Ballroom Studio Ginza", address: "Ginza 7-2-8, Chuo-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6694", lng: "139.7628", station: "Ginza", price: "¥2,500", organizer: "Ballroom Latin Tokyo" },

      // Cumbia
      { title: "Cumbia Night Osaka", danceStyle: "cumbia", eventType: "social", daysFromNow: 7, hour: 20, venue: "El Barrio Osaka", address: "Americamura 1-6-24, Chuo-ku", city: "Osaka", prefecture: "Osaka", lat: "34.6720", lng: "135.4990", station: "Shinsaibashi", price: "¥1,500", organizer: "Cumbia Japan" },

      // Reggaeton
      { title: "Reggaeton Dance Party", danceStyle: "reggaeton", eventType: "social", daysFromNow: 4, hour: 22, venue: "Club Caribe Roppongi", address: "Roppongi 5-16-3, Minato-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6610", lng: "139.7310", station: "Roppongi", price: "¥3,000", organizer: "Reggaeton Japan" },

      // Samba
      { title: "Samba de Gafieira Workshop", danceStyle: "samba", eventType: "workshop", daysFromNow: 11, hour: 14, venue: "Brazilian Culture Center", address: "Yoyogi 1-30-13, Shibuya-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6836", lng: "139.7020", station: "Yoyogi", price: "¥3,000", organizer: "Samba Tokyo" },

      // Tango
      { title: "Argentine Tango Milonga", danceStyle: "tango", eventType: "social", daysFromNow: 2, hour: 20, venue: "Tango Café Kagurazaka", address: "Kagurazaka 3-2-15, Shinjuku-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.7020", lng: "139.7400", station: "Kagurazaka", price: "¥2,000", organizer: "Japan Tango Association" },
      { title: "Tango Nuevo Intensive", danceStyle: "tango", eventType: "bootcamp", daysFromNow: 18, hour: 10, venue: "Tango Studio Kyoto", address: "Kawaramachi Sanjo, Nakagyo-ku", city: "Kyoto", prefecture: "Kyoto", lat: "35.0090", lng: "135.7700", station: "Kawaramachi", price: "¥8,000 (2-day)", organizer: "Kyoto Tango Club" },

      // Rumba
      { title: "Rumba Styling Class", danceStyle: "rumba", eventType: "class", daysFromNow: 6, hour: 17, venue: "Latin Rhythm Studio", address: "Daikanyama 17-6, Shibuya-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6500", lng: "139.7030", station: "Daikanyama", price: "¥2,500", organizer: "Latin Rhythm Tokyo" },

      // Mambo
      { title: "Mambo Monday Social", danceStyle: "mambo", eventType: "social", daysFromNow: 5, hour: 19, venue: "Jazz Club Shimokitazawa", address: "Kitazawa 2-14-2, Setagaya-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6614", lng: "139.6683", station: "Shimokitazawa", price: "¥2,000", organizer: "Mambo Japan" },

      // Afro-Latin
      { title: "Afro-Latin Rhythms Workshop", danceStyle: "afro-latin", eventType: "workshop", daysFromNow: 12, hour: 13, venue: "Roots Dance Studio", address: "Nakameguro 2-7-6, Meguro-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6440", lng: "139.6990", station: "Nakameguro", price: "¥3,500", organizer: "Afro-Latin Tokyo" },

      // Mixed
      { title: "Osaka Latin Party", danceStyle: "mixed", eventType: "social", daysFromNow: 5, hour: 20, venue: "Club Tropicana Osaka", address: "Shinsaibashi 1-5-2, Chuo-ku", city: "Osaka", prefecture: "Osaka", lat: "34.6723", lng: "135.5005", station: "Shinsaibashi", price: "¥2,000", organizer: "Osaka Latin Dance" },
      { title: "Yokohama Latin Social", danceStyle: "mixed", eventType: "social", daysFromNow: 6, hour: 19, venue: "Bay Dance Studio", address: "Minato Mirai 2-3-1", city: "Yokohama", prefecture: "Kanagawa", lat: "35.4559", lng: "139.6325", station: "Minato Mirai", price: "¥2,500", organizer: "Yokohama Dance Studio" },
      { title: "Kobe Latin Night", danceStyle: "mixed", eventType: "social", daysFromNow: 7, hour: 20, venue: "Harbor Dance Kobe", address: "Chuo-ku Kitanagasa-dori 1-9-1", city: "Kobe", prefecture: "Hyogo", lat: "34.6901", lng: "135.1956", station: "Motomachi", price: "¥2,000", organizer: "Kobe Latin Nights" },
      { title: "Sapporo Latin Dance Night", danceStyle: "mixed", eventType: "social", daysFromNow: 9, hour: 19, venue: "Snow Dance Hall", address: "Odori Nishi 4, Chuo-ku", city: "Sapporo", prefecture: "Hokkaido", lat: "43.0590", lng: "141.3540", station: "Odori", price: "¥2,000", organizer: "Sapporo Salsa" },

      // ── PAST EVENTS (history, 1-30 days ago) ───────────────────────────
      { title: "Salsa Social — Last Week", danceStyle: "salsa", eventType: "social", daysFromNow: -7, hour: 19, venue: "Club Salsa Tokyo", address: "Roppongi 3-14-5, Minato-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6625", lng: "139.7314", station: "Roppongi", price: "¥2,500", organizer: "Tokyo Salsa Community" },
      { title: "Bachata Night — 2 Weeks Ago", danceStyle: "bachata", eventType: "social", daysFromNow: -14, hour: 20, venue: "Dance Hall Nagoya", address: "Sakae 3-10-1, Naka-ku", city: "Nagoya", prefecture: "Aichi", lat: "35.1681", lng: "136.9084", station: "Sakae", price: "¥2,000", organizer: "Nagoya Bachata Club" },
      { title: "Zouk Workshop — Last Month", danceStyle: "zouk", eventType: "workshop", daysFromNow: -21, hour: 14, venue: "Flow Dance Studio", address: "Jingumae 6-25-14, Shibuya-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6660", lng: "139.7070", station: "Harajuku", price: "¥3,500", organizer: "Tokyo Zouk Community" },
      { title: "Kizomba Social — 10 Days Ago", danceStyle: "kizomba", eventType: "social", daysFromNow: -10, hour: 21, venue: "Afro Beat Lounge", address: "Azabu-Juban 2-3-5, Minato-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6540", lng: "139.7370", station: "Azabu-Juban", price: "¥3,000", organizer: "Kizomba Tokyo" },
      { title: "Tango Milonga — Last Friday", danceStyle: "tango", eventType: "social", daysFromNow: -3, hour: 20, venue: "Tango Café Kagurazaka", address: "Kagurazaka 3-2-15, Shinjuku-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.7020", lng: "139.7400", station: "Kagurazaka", price: "¥2,000", organizer: "Japan Tango Association" },
      { title: "Osaka Cumbia Night — Past", danceStyle: "cumbia", eventType: "social", daysFromNow: -18, hour: 20, venue: "El Barrio Osaka", address: "Americamura 1-6-24, Chuo-ku", city: "Osaka", prefecture: "Osaka", lat: "34.6720", lng: "135.4990", station: "Shinsaibashi", price: "¥1,500", organizer: "Cumbia Japan" },
      { title: "Samba Party — 2 Weeks Ago", danceStyle: "samba", eventType: "social", daysFromNow: -15, hour: 19, venue: "Brazilian Culture Center", address: "Yoyogi 1-30-13, Shibuya-ku", city: "Tokyo", prefecture: "Tokyo", lat: "35.6836", lng: "139.7020", station: "Yoyogi", price: "¥2,500", organizer: "Samba Tokyo" },
      { title: "Merengue Class — Last Week", danceStyle: "merengue", eventType: "class", daysFromNow: -5, hour: 18, venue: "Latino Bar Ikebukuro", address: "Nishi-Ikebukuro 1-12-1", city: "Tokyo", prefecture: "Tokyo", lat: "35.7295", lng: "139.7109", station: "Ikebukuro", price: "¥1,500", organizer: "Latin Vibes Tokyo" },
    ];

    for (const ev of demoEvents) {
      const startAt = makeDate(ev.daysFromNow, ev.hour);
      const endAt = new Date(startAt);
      endAt.setHours(endAt.getHours() + 3);

      const desc = `Join us for ${ev.title}! A great opportunity to dance and meet fellow dancers in ${ev.city}.`;
      await db.execute(sql`INSERT INTO events (sourceId, title, description, danceStyle, eventType, startAt, endAt, venueName, venueAddress, city, prefecture, latitude, longitude, nearestStation, price, organizer, isVerified) VALUES (${1}, ${ev.title}, ${desc}, ${ev.danceStyle}, ${ev.eventType}, ${startAt}, ${endAt}, ${ev.venue}, ${ev.address}, ${ev.city}, ${ev.prefecture}, ${ev.lat}, ${ev.lng}, ${ev.station}, ${ev.price}, ${ev.organizer}, ${true})`);
    }

    console.log(`[Seed] Seeded ${sources.length} sources and ${demoEvents.length} events (including ${demoEvents.filter(e => e.daysFromNow < 0).length} past events for history)`);
  } catch (error) {
    console.error("[Seed] Error seeding database:", error);
  }
}

// ─── Server Startup ──────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const server = createServer(app);

  // CORS — allowlist enforced in ./cors.ts. Do not replace with reflection.
  app.use(corsMiddleware);

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
