// One-shot manual scrape — runs a single full scrape cycle against all active
// sources and writes events to the database, then exits. The API server does
// this automatically on boot (after a short delay) and every 6h, but there is
// no in-app trigger; use this to repopulate on demand without restarting the
// server.
//
// Usage:  npm run scrape:now
//         (or: npx tsx scripts/scrape-now.ts)
//
// Honors DATABASE_URL from env/.env. Sources must already be seeded (the server
// seeds them on boot). Note: HTML sources need BUILT_IN_FORGE_API_URL/KEY (or
// an LLM key) to extract events — without it only iCal/RSS sources populate.

import "dotenv/config";
import { runAllScrapers } from "../server/scraper";

async function main() {
  const t0 = Date.now();
  await runAllScrapers();
  console.log(`[scrape-now] Cycle finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[scrape-now] Failed:", err);
    process.exit(1);
  });
