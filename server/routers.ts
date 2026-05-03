import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  listEvents,
  getEvent,
  listSources,
  addSource,
  toggleSource,
  deleteSource,
  getRecentScrapeLogs,
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

// ─── Router ──────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
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

  // TODO(auth): once Google login lands, switch `add`, `toggle`, and `delete`
  // below from `publicProcedure` to `protectedProcedure`. They are intentionally
  // public today because no users can authenticate yet — gating them now would
  // make the Sites screen unusable.
  sources: router({
    list: publicProcedure.query(async () => {
      return listSources();
    }),
    add: publicProcedure.input(sourceAddInput).mutation(async ({ input }) => {
      await addSource({
        name: input.name,
        url: input.url,
        sourceType: input.sourceType,
        isUserAdded: true,
        isActive: true,
      });
      return { success: true };
    }),
    toggle: publicProcedure.input(sourceToggleInput).mutation(async ({ input }) => {
      await toggleSource(input.id, input.isActive);
      return { success: true };
    }),
    delete: publicProcedure.input(sourceDeleteInput).mutation(async ({ input }) => {
      await deleteSource(input.id);
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
