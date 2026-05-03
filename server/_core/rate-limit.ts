import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

// ─── Rate limiting ──────────────────────────────────────────────────────────
//
// Two budgets, picked by HTTP method (tRPC uses GET for queries, POST for
// mutations). Per-IP, in-memory; replace the store with Redis if/when we run
// behind multiple instances.
//
// Limits are intentionally generous for queries (the calendar/discover/map
// screens each fire 1-3 query batches and the user can drive them at ~once
// per second by typing in the search box) and tight for mutations (only
// sources.add/toggle/delete + auth.logout are mutations today; abuse looks
// like a script hitting `sources.add` in a loop).
//
// 429 responses include a JSON body so the tRPC client can surface a sensible
// error rather than a network failure.

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

export const queryLimiter = rateLimit({
  windowMs: FIFTEEN_MIN_MS,
  limit: 1500,                  // ≈100 queries/minute average per IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

export const mutationLimiter = rateLimit({
  windowMs: FIFTEEN_MIN_MS,
  limit: 100,                   // ≈6-7 mutations/minute average per IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many write requests. Please wait before retrying." },
});

// Pick which limiter to apply based on HTTP method. tRPC queries are GET,
// mutations are POST. Anything else (PUT/DELETE) we treat as a mutation.
export function trpcRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    queryLimiter(req, res, next);
    return;
  }
  mutationLimiter(req, res, next);
}
