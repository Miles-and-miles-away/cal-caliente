#!/usr/bin/env node

/**
 * Seeds the Firestore EMULATOR with the default scrape sources, demo events,
 * and a few scrapeLogs for local development (see SCHEMA.md for the contract).
 *
 * Emulator-only: no service account. Respects FIRESTORE_EMULATOR_HOST
 * (defaults to 127.0.0.1:8080) and uses project id demo-cal-caliente.
 *
 * Idempotent: doc IDs are deterministic (source slugs, event canonicalKeys,
 * fixed log ids) and all writes are set(..., {merge: true}) — safe to re-run.
 *
 * Usage:
 *   npm run seed                       # against an already-running emulator
 *   firebase emulators:exec --only firestore --project=demo-cal-caliente \
 *     "node scripts/seed/seed_emulator.js"
 */

const { createHash } = require('node:crypto');
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

admin.initializeApp({ projectId: 'demo-cal-caliente' });
const db = admin.firestore();
const { Timestamp } = admin.firestore;

// ─── canonicalKey / venueDateKey ─────────────────────────────────────────────
// Ported verbatim from the old RN app's server (cal-caliente/server/db.ts).
// Keep in sync with the Cloud Functions implementation.

function normalizeTitleForKey(title) {
  return title
    .normalize('NFC')
    .toLowerCase()
    // Strip leading parenthetical/bracketed prefix: "(JAPAN) Foo", "[FESTIVAL] Foo"
    .replace(/^[(\[][^)\]]+[)\]]\s*/, '')
    // Strip 4-digit years (date provides disambiguation)
    .replace(/\b(19|20)\d{2}\b/g, '')
    // Collapse non-alphanumeric runs (incl. CJK punctuation, em-dashes) to one space
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function computeCanonicalKey(title, startAt) {
  const t = normalizeTitleForKey(title);
  const date = (startAt instanceof Date ? startAt : new Date(startAt))
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD — day precision so multi-day festivals match
  return createHash('sha256').update(`${t}|${date}`).digest('hex').slice(0, 32);
}

function normalizeVenueForKey(venue) {
  return venue
    .normalize('NFC')
    .toLowerCase()
    .replace(/\b(bar|club|studio|hall|cafe|lounge|center|centre)\b/gi, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function computeVenueDateKey(venue, startAt) {
  if (!venue) return null;
  const v = normalizeVenueForKey(venue);
  if (v.length < 3) return null;
  const hour = (startAt instanceof Date ? startAt : new Date(startAt))
    .toISOString()
    .slice(0, 13); // YYYY-MM-DDTHH
  return createHash('sha256').update(`${v}|${hour}`).digest('hex').slice(0, 32);
}

// ─── JST date helper ─────────────────────────────────────────────────────────
// Returns a Date at the given JST wall-clock time, `dayOffset` days from
// today (today = today in JST).

function jst(dayOffset, hour, minute = 0) {
  const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
  return new Date(Date.UTC(
    jstNow.getUTCFullYear(),
    jstNow.getUTCMonth(),
    jstNow.getUTCDate() + dayOffset,
    hour - 9,
    minute,
  ));
}

// ─── Sources: the 14 defaults from the old app ───────────────────────────────
// Names/urls/types match cal-caliente/server/_core/index.ts. Deterministic
// slug doc ids keep re-runs idempotent (SCHEMA.md says autoId, but the seed
// uses stable ids on purpose so events can reference them).

const SOURCES = [
  { id: 'salsavida-tokyo', name: 'SalsaVida Tokyo', url: 'https://www.salsavida.com/guides/japan/tokyo/', sourceType: 'html' },
  { id: 'salsavida-osaka', name: 'SalsaVida Osaka', url: 'https://www.salsavida.com/guides/japan/osaka/', sourceType: 'html' },
  { id: 'salsavida-fukuoka', name: 'SalsaVida Fukuoka', url: 'https://www.salsavida.com/guides/japan/fukuoka/', sourceType: 'html' },
  { id: 'salsavida-kyoto', name: 'SalsaVida Kyoto', url: 'https://www.salsavida.com/guides/japan/kyoto/', sourceType: 'html' },
  { id: 'salsavida-yokohama', name: 'SalsaVida Yokohama', url: 'https://www.salsavida.com/guides/japan/yokohama/', sourceType: 'html' },
  { id: 'salsavida-okinawa', name: 'SalsaVida Okinawa', url: 'https://www.salsavida.com/guides/japan/okinawa/', sourceType: 'html' },
  { id: 'latindancecalendar-tokyo', name: 'LatinDanceCalendar Tokyo', url: 'https://latindancecalendar.com/events/location/tokyo-japan/', sourceType: 'html' },
  { id: 'club-salud-schedule', name: 'Club Salud — Schedule', url: 'https://calendar.google.com/calendar/ical/nippori.salud@gmail.com/public/basic.ics', sourceType: 'rss' },
  { id: 'club-salud-special-events', name: 'Club Salud — Special Events', url: 'https://calendar.google.com/calendar/ical/sr0mc5bme09l3b8eaq9nloqoug@group.calendar.google.com/public/basic.ics', sourceType: 'rss' },
  { id: 'club-salud-external', name: 'Club Salud — External', url: 'https://calendar.google.com/calendar/ical/52gpao3m28t2oecbub1rhi685o@group.calendar.google.com/public/basic.ics', sourceType: 'rss' },
  { id: 'club-salud-dj-nights', name: 'Club Salud — DJ Nights', url: 'https://calendar.google.com/calendar/ical/q4avf89fl1sgjkdfj505o7ecvk@group.calendar.google.com/public/basic.ics', sourceType: 'rss' },
  { id: 'meetup-tokyo-salsa-bachata-lessons', name: "Meetup — Tokyo Salsa-Bachata Lessons", url: 'https://www.meetup.com/tokyo-salsa-lessons/events/ical', sourceType: 'rss' },
  { id: 'meetup-la-bachata-tokyo', name: 'Meetup — La Bachata Tokyo', url: 'https://www.meetup.com/la_bachata_tokyo/events/ical', sourceType: 'rss' },
  { id: 'meetup-taps-n-turns-tokyo', name: "Meetup — Taps N' Turns Tokyo", url: 'https://www.meetup.com/tnt-tokyo-salsa-bachata-other-dance-parties/events/ical', sourceType: 'rss' },
];

// ─── Demo events ─────────────────────────────────────────────────────────────
// d = days from today (JST), h = JST start hour. 25 upcoming + 2 past.
// Mix of cities, styles, types; some with coords, some city-only; one
// cancelled, one all-day; a few user-submitted (sourceId null).

const EVENTS = [
  // ── past (2) ──
  { d: -7, h: 20, dur: 4, title: 'Tokyo Salsa Night Vol. 42', style: 'salsa', type: 'social',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Club Salud Nippori', addr: '3-1-5 Nishinippori, Arakawa-ku, Tokyo',
    lat: 35.7326, lng: 139.7668, station: 'Nippori', price: '¥1,500 (1 drink incl.)',
    organizer: 'Club Salud', src: 'club-salud-schedule',
    desc: 'Weekly salsa social with DJ Koji. Beginners welcome from 8pm.' },
  { d: -2, h: 14, dur: 2, title: 'Bachata Sensual Workshop with Yuki & Mario', style: 'bachata', type: 'workshop',
    city: 'Osaka', pref: 'Osaka', venue: 'Studio Olé Umeda', addr: '2-11-8 Sonezaki, Kita-ku, Osaka',
    lat: 34.7003, lng: 135.4983, station: 'Umeda', price: '¥3,500', organizer: 'Yuki & Mario', src: 'salsavida-osaka',
    desc: 'Two-hour intensive on body waves and sensual musicality.' },

  // ── upcoming (25) ──
  { d: 1, h: 21, dur: 4, title: 'Roppongi Salsa Social', style: 'salsa', type: 'social',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Salsa Sudada Roppongi', addr: '7-13-8 Roppongi, Minato-ku, Tokyo',
    lat: 35.6627, lng: 139.7316, station: 'Roppongi', price: '¥1,000 + 1 drink',
    organizer: 'Salsa Sudada', src: 'salsavida-tokyo',
    url: 'https://www.salsavida.com/guides/japan/tokyo/', desc: 'The classic Roppongi Friday social — on1 and on2 floors.' },
  { d: 2, h: 19, dur: 1.5, title: 'Zouk Fundamentals Class', style: 'zouk', type: 'class',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Studio Departure Nakameguro', price: '¥2,500', src: 'meetup-tokyo-salsa-bachata-lessons',
    desc: 'Brazilian zouk basics: lateral, elastic, and simple head movement.' },
  { d: 3, h: 20, dur: 3, title: 'Kizomba Night Osaka', style: 'kizomba', type: 'social',
    city: 'Osaka', pref: 'Osaka', venue: 'Bar Mambo Shinsaibashi', addr: '1-8-21 Higashishinsaibashi, Chuo-ku, Osaka',
    lat: 34.6743, lng: 135.5028, station: 'Shinsaibashi', price: '¥1,500', src: 'salsavida-osaka',
    desc: 'Kizomba and urban kiz sets all night.' },
  { d: 4, h: 19, dur: 3, title: 'Kyoto Latin Social', style: 'mixed', type: 'social',
    city: 'Kyoto', pref: 'Kyoto', venue: 'Café Rumbita Kawaramachi', src: 'salsavida-kyoto',
    desc: 'Salsa, bachata, and merengue by the Kamo river.' },
  { d: 5, h: 20, dur: 4, title: 'Fukuoka Bachata Social', style: 'bachata', type: 'social',
    city: 'Fukuoka', pref: 'Fukuoka', venue: 'El Coyote Tenjin', addr: '3-4-15 Tenjin, Chuo-ku, Fukuoka',
    lat: 33.5904, lng: 130.3988, station: 'Tenjin', price: '¥1,500 (1 drink incl.)', src: 'salsavida-fukuoka',
    desc: 'Monthly bachata night in the heart of Tenjin.' },
  { d: 6, h: 18, dur: 1.5, title: 'Yokohama Salsa On2 Class', style: 'salsa', type: 'class',
    city: 'Yokohama', pref: 'Kanagawa', venue: 'Studio Clave Kannai', addr: '4-57 Sumiyoshicho, Naka-ku, Yokohama',
    lat: 35.4437, lng: 139.6380, station: 'Kannai', price: '¥2,000', organizer: 'Studio Clave', src: 'salsavida-yokohama',
    desc: 'Intermediate on2 partnerwork and shines.' },
  { d: 7, h: 22, dur: 5, title: 'Shibuya Latin Fridays', style: 'mixed', type: 'social',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Bar Fiesta Shibuya', addr: '2-9-1 Dogenzaka, Shibuya-ku, Tokyo',
    lat: 35.6580, lng: 139.6994, station: 'Shibuya', price: '¥2,000 (2 drinks incl.)', src: 'latindancecalendar-tokyo',
    desc: 'Reggaeton, salsa, and bachata across two floors.' },
  { d: 8, h: 15, dur: 2, title: 'Bachata Lady Styling Workshop', style: 'bachata', type: 'workshop',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Studio Aria Ebisu', price: '¥3,000', organizer: 'Aya Nakamura',
    sub: 'demo-user-1', desc: 'Arm styling, hair whips, and follower musicality.' },
  { d: 9, h: 19, dur: 5, title: 'Osaka Zouk Marathon', style: 'zouk', type: 'social',
    city: 'Osaka', pref: 'Osaka', venue: 'Studio Lambada Namba', addr: '2-3-9 Nambanaka, Naniwa-ku, Osaka',
    lat: 34.6614, lng: 135.5011, station: 'Namba', price: '¥2,500', src: 'salsavida-osaka',
    desc: 'Five hours of zouk with guest DJs from Kobe.' },
  { d: 10, h: 18, dur: 1.5, title: 'Salsa & Bachata Crossover Class', style: 'mixed', type: 'class',
    city: 'Kyoto', pref: 'Kyoto', venue: 'Studio K Karasuma', price: '¥2,200', src: 'salsavida-kyoto',
    desc: 'One hour of salsa, thirty minutes of bachata — perfect for socials.' },
  { d: 11, h: 20, dur: 3, title: 'Cuban Salsa Rueda Night', style: 'salsa', type: 'social',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Café Habana Shinjuku', addr: '3-12-9 Shinjuku, Shinjuku-ku, Tokyo',
    lat: 35.6913, lng: 139.7043, station: 'Shinjuku-sanchome', price: '¥1,200', organizer: 'Rueda Tokyo', src: 'club-salud-external',
    desc: 'Casino rueda calling in Spanish and Japanese.' },
  { d: 12, h: 21, dur: 4, title: 'Kizomba Fusion Party', style: 'kizomba', type: 'social',
    city: 'Yokohama', pref: 'Kanagawa', venue: 'Bar Luanda Motomachi', addr: '1-13 Motomachi, Naka-ku, Yokohama',
    lat: 35.4402, lng: 139.6503, station: 'Motomachi-Chukagai', cancelled: true, src: 'salsavida-yokohama',
    desc: 'CANCELLED — venue double-booked. See you next month.' },
  { d: 13, h: 17, dur: 6, title: 'Tokyo Bachata Marathon', style: 'bachata', type: 'festival',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Differ Ariake', addr: '1-3-25 Ariake, Koto-ku, Tokyo',
    lat: 35.6339, lng: 139.7944, station: 'Kokusai-tenjijo', price: '¥8,000 full pass', organizer: 'TBM Committee',
    src: 'latindancecalendar-tokyo', url: 'https://latindancecalendar.com/events/location/tokyo-japan/',
    img: 'https://example.com/img/tbm.jpg', desc: 'Six hours, three rooms, international artist lineup.' },
  { d: 14, h: 19, dur: 2, title: 'Meetup Salsa Practice Session', style: 'salsa', type: 'class',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Yoyogi Olympic Center', price: '¥500', src: 'meetup-tokyo-salsa-bachata-lessons',
    url: 'https://www.meetup.com/tokyo-salsa-lessons/events/ical', desc: 'Guided practica — bring questions from class.' },
  { d: 15, h: 20, dur: 4, title: 'Latin Night at Bar Cielo', style: 'mixed', type: 'social',
    city: 'Fukuoka', pref: 'Fukuoka', venue: 'Bar Cielo Daimyo', addr: '1-2-11 Daimyo, Chuo-ku, Fukuoka',
    lat: 33.5876, lng: 130.3946, station: 'Akasaka', src: 'salsavida-fukuoka',
    desc: 'Salsa hour then open latin floor till late.' },
  { d: 16, h: 14, dur: 3, title: 'Zouk Connection Workshop', style: 'zouk', type: 'workshop',
    city: 'Osaka', pref: 'Osaka', venue: 'Studio Lambada Namba', addr: '2-3-9 Nambanaka, Naniwa-ku, Osaka',
    lat: 34.6614, lng: 135.5011, station: 'Namba', price: '¥4,000', organizer: 'Zouk Osaka', src: 'salsavida-osaka',
    desc: 'Connection drills and counterbalance for all levels.' },
  { d: 17, h: 18, dur: 3, title: 'Salsa Sunday Social', style: 'salsa', type: 'social',
    city: 'Kyoto', pref: 'Kyoto', venue: 'Café Rumbita Kawaramachi', src: 'salsavida-kyoto',
    desc: 'Relaxed Sunday social — cuban and linear friendly.' },
  { d: 18, h: 19, dur: 1.5, title: '(Tokyo) Kizomba Beginners Class', style: 'kizomba', type: 'class',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Studio Ginga Koenji', addr: '3-57-8 Koenjiminami, Suginami-ku, Tokyo',
    lat: 35.7052, lng: 139.6497, station: 'Koenji', price: '¥2,500', src: 'meetup-la-bachata-tokyo',
    desc: 'Ginga, saida, and basic weight transfer from zero.' },
  { d: 19, h: 20, dur: 3, title: 'La Bachata Tokyo Social', style: 'bachata', type: 'social',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Studio Ginga Koenji', addr: '3-57-8 Koenjiminami, Suginami-ku, Tokyo',
    lat: 35.7052, lng: 139.6497, station: 'Koenji', price: '¥1,800', organizer: 'La Bachata Tokyo',
    src: 'meetup-la-bachata-tokyo', url: 'https://www.meetup.com/la_bachata_tokyo/events/ical',
    desc: 'Dominican and sensual sets, 50/50.' },
  { d: 20, h: 21, dur: 5, title: 'Japan Salsa Congress Pre-Party', style: 'salsa', type: 'social',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Club Cactus Roppongi', addr: '5-16-5 Roppongi, Minato-ku, Tokyo',
    lat: 35.6604, lng: 139.7362, station: 'Roppongi', price: '¥2,500 (1 drink incl.)', organizer: 'JSC Committee',
    src: 'latindancecalendar-tokyo', desc: 'Warm-up party with congress artist showcases.' },
  { d: 21, h: 0, allDay: true, title: 'Yokohama Latin Dance Festival', style: 'mixed', type: 'festival',
    city: 'Yokohama', pref: 'Kanagawa', venue: 'Osanbashi Hall', addr: '1-1-4 Kaigandori, Naka-ku, Yokohama',
    lat: 35.4523, lng: 139.6444, station: 'Nihon-odori', price: '¥5,000 day pass', organizer: 'YLDF',
    src: 'salsavida-yokohama', img: 'https://example.com/img/yldf.jpg',
    desc: 'All-day festival on the pier: workshops, shows, and socials.' },
  { d: 23, h: 19, dur: 1.5, title: 'Bachata Moderna Intermediate Class', style: 'bachata', type: 'class',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Studio Aria Ebisu', price: '¥2,800', sub: 'demo-user-2',
    desc: 'Turn patterns and footwork variations.' },
  { d: 24, h: 20, dur: 4, title: 'Osaka Salsa Night — Umeda', style: 'salsa', type: 'social',
    city: 'Osaka', pref: 'Osaka', venue: 'Bar Tropicana Umeda', addr: '1-5-16 Shibata, Kita-ku, Osaka',
    lat: 34.7055, lng: 135.4959, station: 'Umeda', price: '¥1,500', src: 'salsavida-osaka',
    desc: 'DJ Carlos spins classic salsa dura.' },
  { d: 25, h: 22, dur: 4, title: 'Reggaeton & Latin Mix Party', style: 'mixed', type: 'social',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Club Camelot Shibuya', addr: '1-18-2 Jinnan, Shibuya-ku, Tokyo',
    lat: 35.6634, lng: 139.6982, station: 'Shibuya', price: '¥3,000 (2 drinks incl.)', src: 'latindancecalendar-tokyo',
    desc: 'Late-night latin party — dress code smart casual.' },
  { d: 27, h: 13, dur: 5, title: 'Fukuoka Salsa Workshop Weekend', style: 'salsa', type: 'workshop',
    city: 'Fukuoka', pref: 'Fukuoka', venue: 'Studio Momochi', price: '¥6,000 (3 workshops)', organizer: 'Salsa Fukuoka',
    src: 'salsavida-fukuoka', desc: 'Three progressive workshops with a mini-social after.' },
  { d: 29, h: 20, dur: 4, title: 'Golden Week Salsa Special', style: 'salsa', type: 'social',
    city: 'Tokyo', pref: 'Tokyo', venue: 'Club Salud Nippori', addr: '3-1-5 Nishinippori, Arakawa-ku, Tokyo',
    lat: 35.7326, lng: 139.7668, station: 'Nippori', price: '¥2,000 (1 drink incl.)', organizer: 'Club Salud',
    src: 'club-salud-special-events',
    url: 'https://calendar.google.com/calendar/ical/nippori.salud@gmail.com/public/basic.ics',
    desc: 'Extended holiday social with live percussion.' },
];

function buildEventDoc(spec) {
  const startAt = jst(spec.d, spec.h, spec.min || 0);
  const endAt = spec.allDay
    ? jst(spec.d + 1, 0)
    : spec.dur != null
      ? new Date(startAt.getTime() + spec.dur * 3600 * 1000)
      : null;
  const canonicalKey = computeCanonicalKey(spec.title, startAt);
  const now = Timestamp.now();
  return {
    id: canonicalKey,
    data: {
      title: spec.title,
      description: spec.desc ?? null,
      danceStyle: spec.style,
      eventType: spec.type,
      startAt: Timestamp.fromDate(startAt),
      endAt: endAt ? Timestamp.fromDate(endAt) : null,
      isAllDay: spec.allDay === true,
      venueName: spec.venue ?? null,
      venueAddress: spec.addr ?? null,
      city: spec.city ?? null,
      prefecture: spec.pref ?? null,
      latitude: spec.lat ?? null,
      longitude: spec.lng ?? null,
      nearestStation: spec.station ?? null,
      imageUrl: spec.img ?? null,
      sourceUrl: spec.url ?? null,
      price: spec.price ?? null,
      organizer: spec.organizer ?? null,
      sourceId: spec.src ?? null,
      submittedByUid: spec.sub ?? null,
      isVerified: spec.src != null, // scraped = true, user-submitted = false
      isCancelled: spec.cancelled === true,
      canonicalKey,
      venueDateKey: computeVenueDateKey(spec.venue, startAt),
      createdAt: now,
      updatedAt: now,
    },
  };
}

// ─── scrapeLogs under two sources ────────────────────────────────────────────

const SCRAPE_LOGS = [
  { sourceId: 'salsavida-tokyo', id: 'seed-log-1',
    data: { status: 'success', eventsFound: 208, eventsAdded: 31, errorMessage: null, durationMs: 12840 } },
  { sourceId: 'salsavida-tokyo', id: 'seed-log-2',
    data: { status: 'error', eventsFound: 0, eventsAdded: 0, errorMessage: 'HTTP 503 from upstream', durationMs: 3021 } },
  { sourceId: 'club-salud-schedule', id: 'seed-log-1',
    data: { status: 'success', eventsFound: 42, eventsAdded: 5, errorMessage: null, durationMs: 1873 } },
  { sourceId: 'club-salud-schedule', id: 'seed-log-2',
    data: { status: 'partial', eventsFound: 40, eventsAdded: 2, errorMessage: '2 items missing DTSTART', durationMs: 2210 } },
];

// ─── Admin test user (Auth emulator) ─────────────────────────────────────────
// Email/password login with the admin custom claim, for the in-app admin
// panel and the integration test. Skipped (with a warning) if the Auth
// emulator isn't running, so `emulators:exec --only firestore` still works.

const ADMIN_EMAIL = 'admin@calcaliente.test';
const ADMIN_PASSWORD = 'admintest123';

async function seedAdminUser() {
  const auth = admin.auth();
  try {
    let user;
    try {
      user = await auth.getUserByEmail(ADMIN_EMAIL);
    } catch {
      user = await auth.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    }
    await auth.setCustomUserClaims(user.uid, { admin: true });
    console.log(`Seeded admin user ${ADMIN_EMAIL} (uid ${user.uid}, claim admin:true)`);
  } catch (err) {
    console.warn(`Auth emulator not reachable, skipped admin user: ${err.message}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

// Demo events/scrapeLogs are TEST FIXTURES only (--demo). Normal dev seeding
// is sources + admin user; real events come from the scraper (Admin -> Scrape
// now, or the daily schedule). --purge-demo removes previously seeded demo data.
const WITH_DEMO = process.argv.includes('--demo');
const PURGE_DEMO = process.argv.includes('--purge-demo');

async function purgeDemo() {
  const events = EVENTS.map(buildEventDoc);
  const batch = db.batch();
  for (const e of events) batch.delete(db.collection('events').doc(e.id));
  for (const log of SCRAPE_LOGS) {
    batch.delete(
      db.collection('sources').doc(log.sourceId).collection('scrapeLogs').doc(log.id),
    );
  }
  await batch.commit();
  console.log(`Purged ${events.length} demo events and ${SCRAPE_LOGS.length} demo scrapeLogs`);
}

async function main() {
  if (PURGE_DEMO) {
    await purgeDemo();
    return;
  }
  console.log(`Seeding Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST} (project demo-cal-caliente)`);
  const batch = db.batch();
  const now = Timestamp.now();

  for (const s of SOURCES) {
    batch.set(
      db.collection('sources').doc(s.id),
      {
        name: s.name,
        url: s.url,
        sourceType: s.sourceType,
        region: 'japan',
        isActive: true,
        isUserAdded: false,
        addedByUid: null,
        lastScrapedAt: null,
        createdAt: now,
      },
      { merge: true },
    );
  }

  const events = WITH_DEMO ? EVENTS.map(buildEventDoc) : [];
  const ids = new Set();
  for (const e of events) {
    if (ids.has(e.id)) throw new Error(`Duplicate canonicalKey for "${e.data.title}"`);
    ids.add(e.id);
    batch.set(db.collection('events').doc(e.id), e.data, { merge: true });
  }

  if (WITH_DEMO) {
    for (const log of SCRAPE_LOGS) {
      batch.set(
        db.collection('sources').doc(log.sourceId).collection('scrapeLogs').doc(log.id),
        { ...log.data, createdAt: now },
        { merge: true },
      );
    }
  }

  await batch.commit();

  console.log(`Seeded ${SOURCES.length} sources`);
  if (WITH_DEMO) {
    const past = events.filter((e) => e.data.startAt.toDate() < new Date()).length;
    console.log(`Seeded ${events.length} DEMO events (${events.length - past} upcoming, ${past} past) — test fixtures`);
    console.log(`Seeded ${SCRAPE_LOGS.length} demo scrapeLogs across 2 sources`);
  } else {
    console.log('No demo events seeded (use --demo for test fixtures; real events come from the scraper)');
  }
  await seedAdminUser();
  console.log('Done. Re-running is safe (deterministic ids + merge writes).');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
