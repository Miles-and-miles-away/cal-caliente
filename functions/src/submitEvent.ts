import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { z } from "zod";
import { computeCanonicalKey, computeVenueDateKey } from "./keys";
import {
  ALLOWED_URL_PROTOCOLS,
  DANCE_STYLES,
  ENFORCE_APP_CHECK,
  EVENT_TYPES,
  JAPAN_CITY_VALUES,
  MAX_URL_LENGTH,
} from "./constants";

// ─── Input validation ────────────────────────────────────────────────────────
// Mirrors the old tRPC `eventSubmitInput` (server/routers.ts), minus the image
// upload — deliberately dropped (no Storage surface in the relaunch).

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "expected ISO-8601 date");

// Reusable http(s) URL guard (same protocol allowlist as the old server).
const httpUrl = z
  .string()
  .max(MAX_URL_LENGTH)
  .refine(
    (url) => {
      try {
        return (ALLOWED_URL_PROTOCOLS as readonly string[]).includes(
          new URL(url).protocol,
        );
      } catch {
        return false;
      }
    },
    { message: "URL must use https:// or http:// protocol" },
  );

const submitEventInput = z
  .object({
    title: z
      .string()
      .max(500)
      .transform((s) => s.trim())
      .refine((s) => s.length >= 1, { message: "Title is required" }),
    startAt: isoDate,
    endAt: isoDate.optional(),
    description: z.string().max(5000).optional(),
    danceStyle: z.enum(DANCE_STYLES).optional(),
    eventType: z.enum(EVENT_TYPES).optional(),
    venueName: z.string().max(500).optional(),
    venueAddress: z.string().max(2000).optional(),
    city: z.enum(JAPAN_CITY_VALUES).optional(),
    prefecture: z.string().max(100).optional(),
    nearestStation: z.string().max(200).optional(),
    price: z.string().max(200).optional(),
    organizer: z.string().max(300).optional(),
    sourceUrl: httpUrl.optional(),
  })
  .strict();

export type SubmitEventInput = z.infer<typeof submitEventInput>;

/** Pure validation — exported for unit tests. Throws HttpsError on bad input. */
export function validateSubmitEventInput(data: unknown): SubmitEventInput {
  const result = submitEventInput.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".") || "input";
    throw new HttpsError("invalid-argument", `${path}: ${issue?.message ?? "invalid"}`);
  }
  return result.data;
}

// ─── Callable ────────────────────────────────────────────────────────────────
//
// Validated user event submission. Computes canonicalKey (doc id) and
// venueDateKey; in a transaction, rejects with `already-exists` if either
// dedup axis matches an existing event — a submission colliding with a
// scraped row must not rewrite its provenance (same policy as the old
// insertSubmittedEvent → DuplicateEventError).

export const submitEvent = onCall(
  { memory: "256MiB", enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to submit an event.");
  }

  const input = validateSubmitEventInput(request.data);
  const startAt = new Date(input.startAt);
  const canonicalKey = computeCanonicalKey(input.title, startAt);
  const venueDateKey = computeVenueDateKey(input.venueName, startAt);

  const db = getFirestore();
  const eventsCol = db.collection("events");
  const ref = eventsCol.doc(canonicalKey);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      const data = existing.data() ?? {};
      throw new HttpsError(
        "already-exists",
        "This event looks like it's already on the calendar: " +
          `"${String(data.title ?? "")}" (id: ${existing.id})`,
        { id: existing.id, title: data.title ?? null },
      );
    }
    if (venueDateKey) {
      const dupes = await tx.get(
        eventsCol.where("venueDateKey", "==", venueDateKey).limit(1),
      );
      if (!dupes.empty) {
        const dupe = dupes.docs[0];
        const data = dupe.data();
        throw new HttpsError(
          "already-exists",
          "An event at this venue and time is already on the calendar: " +
            `"${String(data.title ?? "")}" (id: ${dupe.id})`,
          { id: dupe.id, title: data.title ?? null },
        );
      }
    }

    const now = Timestamp.now();
    const endAt = input.endAt ? new Date(input.endAt) : null;
    tx.create(ref, {
      title: input.title,
      description: input.description ?? null,
      danceStyle: input.danceStyle ?? "mixed",
      eventType: input.eventType ?? "other",
      startAt: Timestamp.fromDate(startAt),
      endAt: endAt ? Timestamp.fromDate(endAt) : null,
      isAllDay: false,
      venueName: input.venueName ?? null,
      venueAddress: input.venueAddress ?? null,
      city: input.city ?? null,
      prefecture: input.prefecture ?? null,
      latitude: null,
      longitude: null,
      nearestStation: input.nearestStation ?? null,
      imageUrl: null,
      sourceUrl: input.sourceUrl ?? null,
      price: input.price ?? null,
      organizer: input.organizer ?? null,
      sourceId: null,
      submittedByUid: uid,
      isVerified: false,
      isCancelled: false,
      canonicalKey,
      venueDateKey,
      createdAt: now,
      updatedAt: now,
    });
  });

  logger.info(`[submitEvent] ${uid} created events/${canonicalKey} ("${input.title}")`);
  return { id: canonicalKey };
});
