import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { corsMiddleware, isOriginAllowed } from "../server/_core/cors";

type HeaderMap = Record<string, string>;

function makeReq(method: string, origin?: string): Request {
  return {
    method,
    headers: origin ? { origin } : {},
  } as unknown as Request;
}

function makeRes(): {
  res: Response;
  headers: HeaderMap;
  statusSent?: number;
} {
  const headers: HeaderMap = {};
  const state: { statusSent?: number } = {};
  const res = {
    header(name: string, value: string) {
      headers[name] = value;
      return this;
    },
    sendStatus(code: number) {
      state.statusSent = code;
      return this;
    },
  } as unknown as Response;
  return { res, headers, ...state };
}

describe("isOriginAllowed", () => {
  const originalEnv = process.env.ALLOWED_ORIGINS;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = originalEnv;
  });

  it("allows localhost on any port", () => {
    expect(isOriginAllowed("http://localhost:8081")).toBe(true);
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
    expect(isOriginAllowed("https://localhost")).toBe(true);
  });

  it("allows 127.0.0.1 on any port", () => {
    expect(isOriginAllowed("http://127.0.0.1:8081")).toBe(true);
  });

  it("allows the Manus preview pattern", () => {
    expect(
      isOriginAllowed("https://8081-abc123.region.manuspre.computer"),
    ).toBe(true);
    expect(
      isOriginAllowed("https://3000-xxx.manuspre.computer"),
    ).toBe(true);
  });

  it("rejects look-alike domains", () => {
    expect(isOriginAllowed("https://evil.example")).toBe(false);
    expect(
      isOriginAllowed("https://manuspre.computer.evil.example"),
    ).toBe(false);
    expect(
      isOriginAllowed("https://8081-abc.manuspre.computer.evil"),
    ).toBe(false);
  });

  it("rejects empty / missing origin", () => {
    expect(isOriginAllowed("")).toBe(false);
  });

  it("honors ALLOWED_ORIGINS env var", () => {
    process.env.ALLOWED_ORIGINS = "https://prod.example.com, https://staging.example.com";
    expect(isOriginAllowed("https://prod.example.com")).toBe(true);
    expect(isOriginAllowed("https://staging.example.com")).toBe(true);
    expect(isOriginAllowed("https://prod.example.com.evil")).toBe(false);
  });
});

describe("corsMiddleware", () => {
  let nextCalled: boolean;
  const next = () => {
    nextCalled = true;
  };
  beforeEach(() => {
    nextCalled = false;
  });

  it("does not echo Allow-Origin for a disallowed origin", () => {
    const { res, headers } = makeRes();
    corsMiddleware(makeReq("GET", "https://evil.example"), res, next);

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
    expect(nextCalled).toBe(true);
  });

  it("sets credentialed CORS headers for an allowed origin", () => {
    const { res, headers } = makeRes();
    corsMiddleware(makeReq("GET", "http://localhost:8081"), res, next);

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:8081");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headers["Vary"]).toBe("Origin");
    expect(nextCalled).toBe(true);
  });

  it("rejects preflight from a disallowed origin with 403", () => {
    const res = makeRes();
    corsMiddleware(makeReq("OPTIONS", "https://evil.example"), res.res, next);

    // sendStatus is captured as a side effect on the res mock — assert via headers absence
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(nextCalled).toBe(false);
  });

  it("answers preflight from an allowed origin with 204 and no next()", () => {
    const res = makeRes();
    corsMiddleware(makeReq("OPTIONS", "http://localhost:8081"), res.res, next);

    expect(res.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:8081");
    expect(nextCalled).toBe(false);
  });

  it("allows requests with no Origin header (native mobile, curl) to pass through", () => {
    const { res, headers } = makeRes();
    corsMiddleware(makeReq("GET"), res, next);

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(nextCalled).toBe(true);
  });
});
