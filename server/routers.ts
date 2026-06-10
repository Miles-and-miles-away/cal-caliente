import { z } from "zod";
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
} from "./db";
import {
  ALLOWED_URL_PROTOCOLS,
  MAX_URL_LENGTH,
  MAX_SOURCE_NAME_LENGTH,
  API_MAX_PAGE_SIZE,
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
