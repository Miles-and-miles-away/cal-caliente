import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { getActiveSources, runScrape, SourceRecord } from "./scraper";
import { ENFORCE_APP_CHECK } from "./constants";

// Many sources × a 15s fetch timeout each (bounded 4-way concurrency), plus
// LLM extraction on the HTML ones — give the cycle plenty of headroom.
const SCRAPE_TIMEOUT_SECONDS = 540;

// ─── Scheduled daily scrape ──────────────────────────────────────────────────

export const scrapeSources = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "Asia/Tokyo",
    timeoutSeconds: SCRAPE_TIMEOUT_SECONDS,
    memory: "512MiB",
  },
  async () => {
    const db = getFirestore();
    const sources = await getActiveSources(db);
    await runScrape(db, sources);
  },
);

// ─── Manual trigger ──────────────────────────────────────────────────────────
//
// Scrape one source (by id) or all active sources. Shares the same code path
// as the scheduled function — used for testing and the "refresh source"
// admin action.

export const scrapeNow = onCall(
  {
    memory: "512MiB",
    timeoutSeconds: SCRAPE_TIMEOUT_SECONDS,
    enforceAppCheck: ENFORCE_APP_CHECK,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in to trigger a scrape.");
    }
    // Admin-only: every app user is signed in (anonymously), so uid alone
    // would let anyone burn scrapes/Gemini calls. Grant the claim once via
    // Admin SDK: admin.auth().setCustomUserClaims(uid, { admin: true })
    if (request.auth?.token?.admin !== true) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can trigger a scrape.",
      );
    }

    const sourceId = (request.data as { sourceId?: unknown } | null)?.sourceId;
    if (sourceId !== undefined && typeof sourceId !== "string") {
      throw new HttpsError("invalid-argument", "sourceId must be a string.");
    }

    const db = getFirestore();
    let sources: SourceRecord[];
    if (sourceId) {
      const snap = await db.collection("sources").doc(sourceId).get();
      if (!snap.exists) {
        throw new HttpsError("not-found", `No source with id ${sourceId}.`);
      }
      const data = snap.data() ?? {};
      sources = [
        {
          id: snap.id,
          name: String(data.name ?? ""),
          url: String(data.url ?? ""),
          sourceType: String(data.sourceType ?? ""),
          isUserAdded: data.isUserAdded === true,
        },
      ];
    } else {
      sources = await getActiveSources(db);
    }

    logger.info(`[scrapeNow] ${uid} triggered scrape of ${sources.length} source(s)`);
    return runScrape(db, sources);
  },
);
