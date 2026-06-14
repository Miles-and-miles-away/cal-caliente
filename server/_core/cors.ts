import type { Request, Response, NextFunction } from "express";

// ─── SECURITY: CORS allowlist ───────────────────────────────────────────────
// DO NOT replace this with origin reflection (echoing back `req.headers.origin`
// as `Access-Control-Allow-Origin`). Reflection combined with
// `Allow-Credentials: true` lets ANY website make authenticated cross-origin
// requests against this API — a CSRF vector against logout, preferences, and
// any future authenticated mutation.
//
// If a legitimate origin is being blocked, ADD IT to `DEV_ORIGIN_PATTERNS`
// below or set the `ALLOWED_ORIGINS` env var (comma-separated). Do not loosen
// the check itself.
//
// Native iOS/Android requests do not send an `Origin` header, so this only
// affects browser-based callers (Expo web, future web build).
//
// See docs/security.md § CORS Policy for rationale.
// ────────────────────────────────────────────────────────────────────────────

const DEV_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  // Manus sandbox/preview, e.g. https://8081-abc123.region.manuspre.computer
  // or https://8081-ifa50z...-701a46f8.sg1.manus.computer. The sandbox id can
  // contain hyphens, and the platform domain is manus.computer (older sandboxes
  // used manuspre.computer) — match both.
  /^https:\/\/\d+-[a-z0-9-]+(\.[a-z0-9-]+)*\.manus(pre)?\.computer$/,
];

function parseEnvOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (DEV_ORIGIN_PATTERNS.some((p) => p.test(origin))) return true;
  return parseEnvOrigins().includes(origin);
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (typeof origin === "string" && isOriginAllowed(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Max-Age", "600");
  }

  if (req.method === "OPTIONS") {
    // Preflight: succeed only if the origin was allowed (i.e. headers above were set).
    // If not allowed, return 403 so the browser surfaces a clear failure.
    if (typeof origin === "string" && !isOriginAllowed(origin)) {
      res.sendStatus(403);
      return;
    }
    res.sendStatus(204);
    return;
  }

  next();
}
