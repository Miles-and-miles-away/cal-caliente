// One-off script for iterating on the HTML scraper without restarting the
// server or waiting for the hourly scheduler.
//
// Usage:  npx tsx scripts/test-scrape.ts <url>
// Example: npx tsx scripts/test-scrape.ts https://www.salsavida.com/events/japan/
//
// Prints the raw extracted ScrapedEvent[] as JSON. Does NOT touch the
// database — pure read path through fetch + LLM.

import "dotenv/config";
import { HtmlScraperAdapter } from "../server/scraper";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: npx tsx scripts/test-scrape.ts <url>");
    process.exit(1);
  }

  const adapter = new HtmlScraperAdapter();
  const t0 = Date.now();
  const events = await adapter.scrape(url, "test-scrape");
  const ms = Date.now() - t0;

  console.error(`[test-scrape] Done in ${ms}ms — ${events.length} event(s) extracted from ${url}`);
  console.log(JSON.stringify(events, null, 2));
}

main().catch((err) => {
  console.error("[test-scrape] Failed:", err);
  process.exit(1);
});
