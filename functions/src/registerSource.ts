import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { z } from "zod";
import { assertPublicHost } from "./safeFetch";
import {
  ALLOWED_URL_PROTOCOLS,
  ENFORCE_APP_CHECK,
  MAX_SOURCE_NAME_LENGTH,
  MAX_SOURCE_URL_LENGTH,
  SOURCE_TYPES,
} from "./constants";

// ─── Input validation ────────────────────────────────────────────────────────
// Mirrors the old tRPC `sourceAddInput` (server/routers.ts).

const registerSourceInput = z
  .object({
    name: z
      .string()
      .max(MAX_SOURCE_NAME_LENGTH)
      .transform((s) => s.trim())
      .refine((s) => s.length >= 1, { message: "Name is required" }),
    url: z
      .string()
      .min(1)
      .max(MAX_SOURCE_URL_LENGTH)
      .refine(
        (url) => {
          try {
            const parsed = new URL(url);
            return (ALLOWED_URL_PROTOCOLS as readonly string[]).includes(
              parsed.protocol,
            );
          } catch {
            return false;
          }
        },
        { message: "URL must use https:// or http:// protocol" },
      ),
    // Optional; defaults to "html" (a generic web page scraped via LLM).
    sourceType: z.enum(SOURCE_TYPES).optional(),
  })
  .strict();

export type RegisterSourceInput = z.infer<typeof registerSourceInput>;

/** Pure validation — exported for unit tests. Throws HttpsError on bad input. */
export function validateRegisterSourceInput(data: unknown): RegisterSourceInput {
  const result = registerSourceInput.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".") || "input";
    throw new HttpsError("invalid-argument", `${path}: ${issue?.message ?? "invalid"}`);
  }
  return result.data;
}

// ─── Callable ────────────────────────────────────────────────────────────────

export const registerSource = onCall(
  { memory: "256MiB", enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to register a source.");
  }

  const input = validateRegisterSourceInput(request.data);

  // SSRF guard: the scraper will fetch this URL on a schedule, so reject
  // hosts that resolve to private/loopback/metadata IPs at registration time
  // (safeFetch re-validates on every actual fetch as well).
  try {
    await assertPublicHost(new URL(input.url).hostname);
  } catch (err) {
    throw new HttpsError(
      "invalid-argument",
      `URL host is not publicly reachable: ${(err as Error).message}`,
    );
  }

  const db = getFirestore();
  const sourcesCol = db.collection("sources");

  // Firestore has no unique constraint on `url`; the transaction closes the
  // query→create race (same guarantee the old MySQL UNIQUE index provided).
  const newRef = sourcesCol.doc();
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(
      sourcesCol.where("url", "==", input.url).limit(1),
    );
    if (!existing.empty) {
      throw new HttpsError(
        "already-exists",
        "This source is already being tracked.",
        { id: existing.docs[0].id },
      );
    }
    tx.create(newRef, {
      name: input.name,
      url: input.url,
      sourceType: input.sourceType ?? "html",
      region: "japan",
      isActive: true,
      isUserAdded: true,
      addedByUid: uid,
      lastScrapedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  logger.info(`[registerSource] ${uid} created sources/${newRef.id} (${input.url})`);
  return { id: newRef.id };
});
