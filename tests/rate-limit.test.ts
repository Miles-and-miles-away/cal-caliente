import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { trpcRateLimit } from "../server/_core/rate-limit";

// Quick integration test against a small Express app that mounts only the
// limiter — exercises the real middleware without spinning up the full server.
//
// Note: express-rate-limit's in-memory store is module-scoped, so each test
// shares state. We use distinct IPs per test (via `X-Forwarded-For` after
// trusting the proxy) to keep buckets independent.

function makeApp() {
  const app = express();
  // 1 = trust one proxy hop, which is what we'd actually want in production
  // behind Manus / a typical reverse proxy. Avoids the express-rate-limit
  // permissive-trust-proxy warning that fires on `true`.
  app.set("trust proxy", 1);
  app.use(trpcRateLimit);
  app.get("/q", (_req, res) => res.json({ ok: true }));
  app.post("/m", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("trpcRateLimit", () => {
  let app: ReturnType<typeof makeApp>;

  afterEach(() => {
    // Each test gets a fresh app (and therefore fresh limiter state — express-
    // rate-limit's default memory store is per-instance, but our module
    // exports module-scoped singletons. The IP separation below is what
    // actually keeps tests isolated.)
    app = makeApp();
  });

  it("allows queries through under the budget", async () => {
    app = makeApp();
    const res = await request(app).get("/q").set("X-Forwarded-For", "10.0.0.1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("emits standard rate-limit headers on a successful response", async () => {
    app = makeApp();
    const res = await request(app).get("/q").set("X-Forwarded-For", "10.0.0.2");
    // draft-7 RateLimit headers should be present.
    expect(res.headers["ratelimit"]).toBeTruthy();
    expect(res.headers["ratelimit-policy"]).toBeTruthy();
  });

  it("uses the lower mutation budget for POST", async () => {
    app = makeApp();
    const res = await request(app).post("/m").set("X-Forwarded-For", "10.0.0.3");
    expect(res.status).toBe(200);
    // Mutation policy declares limit=100; query policy declares limit=1500.
    // Confirm we're on the mutation track.
    const policy = res.headers["ratelimit-policy"] || "";
    expect(policy).toContain("100");
    expect(policy).not.toContain("1500");
  });

  it("uses the higher query budget for GET", async () => {
    app = makeApp();
    const res = await request(app).get("/q").set("X-Forwarded-For", "10.0.0.4");
    const policy = res.headers["ratelimit-policy"] || "";
    expect(policy).toContain("1500");
  });
});
