import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  listEvents,
  getEvent,
  listSources,
  addSource,
  toggleSource,
  deleteSource,
  getRecentScrapeLogs,
  getUserPreferences,
  upsertUserPreferences,
  insertSubmittedEvent,
  DuplicateEventError,
  getEventAttendance,
  setEventAttendance,
  getEventAttendanceCounts,
} from "./db";
import { storagePut } from "./storage";
import {
  ALLOWED_URL_PROTOCOLS,
  MAX_URL_LENGTH,
  MAX_SOURCE_NAME_LENGTH,
  API_MAX_PAGE_SIZE,
  DANCE_STYLES,
  EVENT_TYPES,
} from "../shared/constants";

// ─── Input Validation Schemas ────────────────────────────────────────────────

// Accept ISO-8601 with or without timezone offset. The previous schema fell
// back to `z.string().max(30)` which let arbitrary garbage through; that
// produced `Invalid Date` in the SQL query and silently dropped the filter.
const isoDate = z
  .string()
  .max(30)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Invalid ISO-8601 date",
  });

const eventListInput = z.object({
  danceStyle: z.string().max(20).optional(),
  eventType: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  search: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(API_MAX_PAGE_SIZE).optional(),
  offset: z.number().int().min(0).optional(),
});

const eventGetInput = z.object({
  id: z.number().int().positive(),
});

// Reusable http(s) URL guard (same protocol allowlist as `sourceAddInput`).
const httpUrl = z
  .string()
  .max(MAX_URL_LENGTH)
  .refine(
    (url) => {
      try {
        return ALLOWED_URL_PROTOCOLS.includes(new URL(url).protocol as any);
      } catch {
        return false;
      }
    },
    { message: "URL must use https:// or http:// protocol" }
  );

// Manual "submit an event" form. Mirrors the writable, user-facing columns on
// `events` (cf. the LLM `llmEventSchema` in event-extractor.ts) but for hand
// entry. `.strict()` rejects unknown keys at the edge. The optional image is a
// base64 payload the resolver uploads to storage; size is bounded here (coarse)
// and again in the resolver (decoded bytes) to stay under the 1MB request limit.
const eventSubmitInput = z
  .object({
    title: z.string().max(500).transform((s) => s.trim()).refine((s) => s.length >= 1, {
      message: "Title is required",
    }),
    startAt: isoDate,
    endAt: isoDate.optional(),
    description: z.string().max(5000).optional(),
    danceStyle: z.enum(DANCE_STYLES).optional(),
    eventType: z.enum(EVENT_TYPES).optional(),
    venueName: z.string().max(500).optional(),
    venueAddress: z.string().max(2000).optional(),
    city: z.string().max(100).optional(),
    prefecture: z.string().max(100).optional(),
    nearestStation: z.string().max(200).optional(),
    price: z.string().max(200).optional(),
    organizer: z.string().max(300).optional(),
    sourceUrl: httpUrl.optional(),
    image: z
      .object({
        base64: z.string().min(1).max(1_400_000),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .optional(),
  })
  .strict();

// Decoded image must stay well under the 1MB Express body limit
// (server/_core/index.ts) once base64 + JSON envelope overhead is added.
const MAX_SUBMISSION_IMAGE_BYTES = 600 * 1024;

const eventAttendanceInput = z.object({
  eventId: z.number().int().positive(),
});

// `status: null` clears the caller's RSVP. The two real states map to the
// `event_attendance.status` enum.
const eventSetAttendanceInput = z.object({
  eventId: z.number().int().positive(),
  status: z.enum(["interested", "going"]).nullable(),
});

// Batched counts for the visible cards. Capped at one list page so the GET
// query string (httpBatchLink encodes input in the URL) stays bounded.
const eventAttendanceCountsInput = z.object({
  eventIds: z.array(z.number().int().positive()).max(API_MAX_PAGE_SIZE),
});

const sourceAddInput = z.object({
  name: z.string().min(1).max(MAX_SOURCE_NAME_LENGTH).transform((s) => s.trim()),
  url: z
    .string()
    .min(1)
    .max(MAX_URL_LENGTH)
    .url()
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return ALLOWED_URL_PROTOCOLS.includes(parsed.protocol as any);
        } catch {
          return false;
        }
      },
      { message: "URL must use https:// or http:// protocol" }
    ),
  sourceType: z.enum(["facebook", "instagram", "rss", "html", "custom"]),
});

const sourceToggleInput = z.object({
  id: z.number().int().positive(),
  isActive: z.boolean(),
});

const sourceDeleteInput = z.object({
  id: z.number().int().positive(),
});

// Mirrors the allowlisted columns in `upsertUserPreferences` (server/db.ts).
// `.strict()` rejects unknown keys at the edge as defense-in-depth alongside the
// db-layer allowlist — a caller can never reach a non-preference column. All
// fields optional: upsert is a partial patch, only provided keys are written.
//
// `danceStyleFilter` (single-select, default "all") and `eventTypeFilters` match
// their columns as-is. When/if the Settings screen syncs its multi-select arrays,
// we'll revisit the representation then — no need to widen the schema now while
// nothing consumes these procedures.
const preferencesUpsertInput = z
  .object({
    city: z.string().max(100),
    prefecture: z.string().max(100),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    maxDistanceKm: z.number().int().min(0).max(1000),
    nearestStation: z.string().max(200),
    maxWalkMinutes: z.number().int().min(0).max(600),
    danceStyleFilter: z.string().max(50),
    eventTypeFilters: z.string().max(2000),
    notificationsEnabled: z.boolean(),
    notifyBeforeHours: z.number().int().min(0).max(8760),
    theme: z.enum(["light", "dark", "system"]),
  })
  .partial()
  .strict();

// ─── Router ──────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    // `me` stays public: the frontend calls it on every load to discover whether
    // a session exists, and it returns null (not an error) when unauthenticated.
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: protectedProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  events: router({
    list: publicProcedure.input(eventListInput).query(async ({ input }) => {
      return listEvents(input);
    }),
    get: publicProcedure.input(eventGetInput).query(async ({ input }) => {
      return getEvent(input.id);
    }),
    // Manual user submission. Gated behind auth and attributed to ctx.user.id;
    // the event is created `isVerified: false` and shows up for everyone via
    // the public `events.list`. Duplicates of an existing event are rejected
    // (CONFLICT) rather than merged.
    submit: protectedProcedure
      .input(eventSubmitInput)
      .mutation(async ({ ctx, input }) => {
        let imageUrl: string | undefined;
        if (input.image) {
          // expo-image-picker returns raw base64; strip a data-URI prefix defensively.
          const base64 = input.image.base64.replace(/^data:[^;]+;base64,/, "");
          const buffer = Buffer.from(base64, "base64");
          if (buffer.length === 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Image could not be decoded." });
          }
          if (buffer.length > MAX_SUBMISSION_IMAGE_BYTES) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Image is too large — please choose one under 600KB.",
            });
          }
          const ext =
            input.image.mimeType === "image/png"
              ? "png"
              : input.image.mimeType === "image/webp"
                ? "webp"
                : "jpg";
          try {
            const { url } = await storagePut(
              `submissions/event.${ext}`,
              buffer,
              input.image.mimeType,
            );
            imageUrl = url;
          } catch {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Image upload failed. Try again or submit without an image.",
            });
          }
        }

        try {
          const { id } = await insertSubmittedEvent(
            {
              title: input.title,
              startAt: input.startAt,
              endAt: input.endAt,
              description: input.description,
              danceStyle: input.danceStyle,
              eventType: input.eventType,
              venueName: input.venueName,
              venueAddress: input.venueAddress,
              city: input.city,
              prefecture: input.prefecture,
              nearestStation: input.nearestStation,
              price: input.price,
              organizer: input.organizer,
              sourceUrl: input.sourceUrl,
              imageUrl,
            },
            ctx.user.id,
          );
          return { success: true, id };
        } catch (err) {
          if (err instanceof DuplicateEventError) {
            throw new TRPCError({ code: "CONFLICT", message: err.message });
          }
          throw err;
        }
      }),
    // Public RSVP summary: aggregate interested/going counts (visible to everyone
    // for social proof) plus the caller's own status (null when signed out — uses
    // the same nullable-ctx.user pattern as the public `auth.me`).
    attendance: publicProcedure.input(eventAttendanceInput).query(async ({ ctx, input }) => {
      return getEventAttendance(input.eventId, ctx.user?.id);
    }),
    // Public batched counts for browse-time social proof on cards. No myStatus —
    // cards show only the aggregate totals.
    attendanceCounts: publicProcedure
      .input(eventAttendanceCountsInput)
      .query(async ({ input }) => {
        return getEventAttendanceCounts(input.eventIds);
      }),
    // Set / clear the caller's own RSVP, then return the fresh summary so the UI
    // can update without a second round-trip. Personal "Save to My Calendar"
    // (favorites) is unrelated and stays device-local.
    setAttendance: protectedProcedure
      .input(eventSetAttendanceInput)
      .mutation(async ({ ctx, input }) => {
        await setEventAttendance(ctx.user.id, input.eventId, input.status);
        return getEventAttendance(input.eventId, ctx.user.id);
      }),
  }),

  // `list` is public (read-only). The mutations are gated: now that users can
  // authenticate (OAuth via the Manus SDK), registering/toggling/deleting a
  // source requires a signed-in user. This closes the unauthenticated-write hole
  // the old TODO(auth) marker tracked.
  sources: router({
    list: publicProcedure.query(async () => {
      return listSources();
    }),
    add: protectedProcedure.input(sourceAddInput).mutation(async ({ input }) => {
      await addSource({
        name: input.name,
        url: input.url,
        sourceType: input.sourceType,
        isUserAdded: true,
        isActive: true,
      });
      return { success: true };
    }),
    toggle: protectedProcedure.input(sourceToggleInput).mutation(async ({ input }) => {
      await toggleSource(input.id, input.isActive);
      return { success: true };
    }),
    delete: protectedProcedure.input(sourceDeleteInput).mutation(async ({ input }) => {
      await deleteSource(input.id);
      return { success: true };
    }),
  }),

  // Server-side per-user preferences. Gated behind auth: a user can only read and
  // write their own row, keyed by `ctx.user.id` (never a client-supplied userId,
  // which would be an IDOR). The db helper allowlists writable columns.
  preferences: router({
    get: protectedProcedure.query(({ ctx }) => {
      return getUserPreferences(ctx.user.id);
    }),
    upsert: protectedProcedure
      .input(preferencesUpsertInput)
      .mutation(async ({ ctx, input }) => {
        await upsertUserPreferences(ctx.user.id, input);
        return { success: true };
      }),
  }),

  scraper: router({
    logs: publicProcedure.query(async () => {
      return getRecentScrapeLogs(20);
    }),
  }),
});

export type AppRouter = typeof appRouter;
