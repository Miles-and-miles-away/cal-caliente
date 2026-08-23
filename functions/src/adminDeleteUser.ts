import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { ENFORCE_APP_CHECK } from "./constants";

const BATCH_LIMIT = 400;

/**
 * Admin-only: delete a user's auth account and their data — users/{uid},
 * their user-added sources, and their RSVPs. Their submitted events stay
 * (community content; admin deletes those individually if needed).
 */
export const adminDeleteUser = onCall(
  { memory: "256MiB", timeoutSeconds: 120, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    if (request.auth.token.admin !== true) {
      throw new HttpsError("permission-denied", "Only admins can delete users.");
    }
    const uid = (request.data as { uid?: unknown } | null)?.uid;
    if (typeof uid !== "string" || uid.length === 0 || uid.length > 128) {
      throw new HttpsError("invalid-argument", "uid must be a non-empty string.");
    }
    if (uid === request.auth.uid) {
      throw new HttpsError("failed-precondition", "You cannot delete yourself.");
    }

    const db = getFirestore();
    const refs: FirebaseFirestore.DocumentReference[] = [db.doc(`users/${uid}`)];

    const sources = await db
      .collection("sources")
      .where("addedByUid", "==", uid)
      .get();
    refs.push(...sources.docs.map((d) => d.ref));

    // RSVPs live at events/{id}/attendance/{uid} — keyed by uid, so finding
    // them means probing every event. O(events) getAll scan; fine at
    // hundreds of events, move to a uid field + collection-group query if the
    // events collection ever grows past ~10k.
    const events = await db.collection("events").select().get();
    let deletedRsvps = 0;
    const attRefs = events.docs.map((d) => d.ref.collection("attendance").doc(uid));
    for (let i = 0; i < attRefs.length; i += BATCH_LIMIT) {
      const snaps = await db.getAll(...attRefs.slice(i, i + BATCH_LIMIT));
      const existing = snaps.filter((s) => s.exists).map((s) => s.ref);
      deletedRsvps += existing.length;
      refs.push(...existing);
    }

    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
      await batch.commit();
    }

    try {
      await getAuth().deleteUser(uid);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/user-not-found") throw e;
      // Firestore-only residue (e.g. auth account already gone) is fine.
    }

    logger.info(
      `[adminDeleteUser] ${request.auth.uid} deleted ${uid}: ` +
        `${sources.size} sources, ${deletedRsvps} RSVPs`,
    );
    return { deletedSources: sources.size, deletedRsvps };
  },
);
