export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

type Env = typeof ENV;

// Each entry maps a documented env var to the ENV field holding it and what
// breaks when it's empty. Kept as data so validateEnv can build a precise,
// actionable message. The single source of truth for every key is `.env.example`.
const REQUIRED_ENV: { key: string; field: keyof Env; breaks: string }[] = [
  { key: "DATABASE_URL", field: "databaseUrl", breaks: "all DB reads/writes (events, users, preferences)" },
  { key: "JWT_SECRET", field: "cookieSecret", breaks: "session signing — auth is insecure/broken" },
  { key: "OAUTH_SERVER_URL", field: "oAuthServerUrl", breaks: "OAuth token exchange — login fails" },
  { key: "VITE_APP_ID", field: "appId", breaks: "OAuth app identity — login fails" },
];

const OPTIONAL_ENV: { key: string; field: keyof Env; breaks: string }[] = [
  { key: "BUILT_IN_FORGE_API_URL", field: "forgeApiUrl", breaks: "LLM event extraction (HTML scraper); iCal sources still work" },
  { key: "BUILT_IN_FORGE_API_KEY", field: "forgeApiKey", breaks: "LLM event extraction (HTML scraper); iCal sources still work" },
  { key: "OWNER_OPEN_ID", field: "ownerOpenId", breaks: "granting the owner the admin role (adminProcedure stays unreachable)" },
];

/**
 * Fail-fast environment check, run once at server startup (see server/_core/index.ts).
 *
 * Missing REQUIRED vars THROW in production — a misconfigured server must never
 * accept traffic — but only WARN in development, so you can boot the API without
 * a full login/LLM setup. Missing OPTIONAL vars always warn. This turns the
 * silent-divergence failure mode (a var Manus injects but a standalone build
 * lacks) into a loud, named error instead of a login that quietly goes nowhere.
 */
export function validateEnv(env: Env = ENV): void {
  for (const c of OPTIONAL_ENV) {
    if (!env[c.field]) console.warn(`[env] ${c.key} is not set — disables ${c.breaks}.`);
  }

  const missing = REQUIRED_ENV.filter((c) => !env[c.field]);
  if (missing.length === 0) return;

  const detail = missing.map((c) => `  - ${c.key}: ${c.breaks}`).join("\n");
  const message =
    `[env] Missing required environment variables:\n${detail}\n` +
    `Copy .env.example to .env and fill these in.`;

  if (env.isProduction) throw new Error(message);
  console.warn(`${message}\n[env] Booting anyway (development) — the above features are broken until set.`);
}
