import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const.js";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { sdk } from "../server/_core/sdk";

// Capture the route handlers off a fake Express app, then drive them with fake
// req/res objects (same approach as cors.test.ts — no real HTTP server).
type Handler = (req: Request, res: Response) => Promise<void> | void;

const routes = new Map<string, Handler>();
const fakeApp = {
  get: (path: string, h: Handler) => routes.set(`GET ${path}`, h),
  post: (path: string, h: Handler) => routes.set(`POST ${path}`, h),
} as unknown as Express;

registerOAuthRoutes(fakeApp);

function makeReq(query: Record<string, unknown> = {}, headers: Record<string, string> = {}): Request {
  return {
    query,
    headers,
    protocol: "https",
    hostname: "3000-abc.manuspre.computer",
  } as unknown as Request;
}

function makeRes() {
  const state: {
    status?: number;
    json?: unknown;
    redirect?: { code: number; url: string };
    cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>;
    cleared: Array<{ name: string; options: Record<string, unknown> }>;
  } = { cookies: [], cleared: [] };
  const res = {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.json = body;
      return this;
    },
    redirect(code: number, url: string) {
      state.redirect = { code, url };
    },
    cookie(name: string, value: string, options: Record<string, unknown>) {
      state.cookies.push({ name, value, options });
    },
    clearCookie(name: string, options: Record<string, unknown>) {
      state.cleared.push({ name, options });
    },
  } as unknown as Response;
  return { res, state };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(["GET /api/oauth/callback", "GET /api/oauth/mobile"])("%s", (route) => {
  it("rejects a request missing state with 400, without touching the OAuth server", async () => {
    const exchange = vi.spyOn(sdk, "exchangeCodeForToken");
    const { res, state } = makeRes();
    await routes.get(route)!(makeReq({ code: "abc" }), res);
    expect(state.status).toBe(400);
    expect(state.json).toEqual({ error: "code and state are required" });
    expect(exchange).not.toHaveBeenCalled();
  });

  it("rejects a request missing code with 400", async () => {
    const { res, state } = makeRes();
    await routes.get(route)!(makeReq({ state: "abc" }), res);
    expect(state.status).toBe(400);
  });

  it("rejects array-valued query params (Express qs quirk) with 400", async () => {
    const { res, state } = makeRes();
    await routes.get(route)!(makeReq({ code: ["a", "b"], state: "s" }), res);
    expect(state.status).toBe(400);
  });

  it("maps a failed token exchange to a 500, not a crash", async () => {
    vi.spyOn(sdk, "exchangeCodeForToken").mockRejectedValue(new Error("exchange down"));
    const { res, state } = makeRes();
    await routes.get(route)!(makeReq({ code: "c", state: "s" }), res);
    expect(state.status).toBe(500);
    expect(state.cookies).toHaveLength(0);
  });
});

describe("GET /api/oauth/callback (success path)", () => {
  it("sets the session cookie for one year and redirects to the frontend", async () => {
    vi.spyOn(sdk, "exchangeCodeForToken").mockResolvedValue({ accessToken: "at" } as any);
    vi.spyOn(sdk, "getUserInfo").mockResolvedValue({ openId: "u-1", name: "Miles" } as any);
    vi.spyOn(sdk, "createSessionToken").mockResolvedValue("session-jwt");

    const { res, state } = makeRes();
    await routes.get("GET /api/oauth/callback")!(makeReq({ code: "c", state: "s" }), res);

    expect(state.cookies).toHaveLength(1);
    const cookie = state.cookies[0];
    expect(cookie.name).toBe(COOKIE_NAME);
    expect(cookie.value).toBe("session-jwt");
    expect(cookie.options).toMatchObject({
      maxAge: ONE_YEAR_MS,
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: ".manuspre.computer",
    });
    expect(state.redirect?.code).toBe(302);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie with the same scoping options it was set with", async () => {
    const { res, state } = makeRes();
    await routes.get("POST /api/auth/logout")!(makeReq(), res);
    expect(state.cleared).toHaveLength(1);
    expect(state.cleared[0].name).toBe(COOKIE_NAME);
    // maxAge -1 + matching domain/path is what actually deletes it in browsers.
    expect(state.cleared[0].options).toMatchObject({
      maxAge: -1,
      path: "/",
      domain: ".manuspre.computer",
    });
    expect(state.json).toEqual({ success: true });
  });
});

describe("POST /api/auth/session (cookie from Bearer token)", () => {
  it("rejects an unauthenticated request with 401", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockRejectedValue(new Error("bad session"));
    const { res, state } = makeRes();
    await routes.get("POST /api/auth/session")!(makeReq(), res);
    expect(state.status).toBe(401);
    expect(state.cookies).toHaveLength(0);
  });

  it("requires a Bearer authorization header even when authenticated", async () => {
    // authenticateRequest can succeed via an existing cookie; the endpoint must
    // still demand the Bearer token since that's the value it sets as cookie.
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ openId: "u-1" } as any);
    const { res, state } = makeRes();
    await routes.get("POST /api/auth/session")!(makeReq({}, {}), res);
    expect(state.status).toBe(400);
    expect(state.json).toEqual({ error: "Bearer token required" });
  });

  it("sets the Bearer token as the session cookie on success", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ openId: "u-1", name: "M" } as any);
    const { res, state } = makeRes();
    await routes.get("POST /api/auth/session")!(
      makeReq({}, { authorization: "Bearer jwt-token-value" }),
      res,
    );
    expect(state.cookies).toHaveLength(1);
    expect(state.cookies[0].value).toBe("jwt-token-value");
    expect(state.cookies[0].options).toMatchObject({ maxAge: ONE_YEAR_MS, httpOnly: true });
  });
});
