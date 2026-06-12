import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { SDKServer } from "../server/_core/sdk";
import { ENV } from "../server/_core/env";

// ─── OAuth state validation (decodeState via exchangeCodeForToken) ──────────
//
// The `state` query param is attacker-controlled and its decoded redirectUri is
// sent to the OAuth token exchange. These tests pin the validation that stops a
// crafted state from smuggling arbitrary content into that exchange — and that
// rejection happens BEFORE any network call.

const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64");

function makeSdk() {
  const post = vi.fn().mockResolvedValue({ data: { accessToken: "tok" } });
  const client = { post } as unknown as AxiosInstance;
  return { sdk: new SDKServer(client), post };
}

describe("exchangeCodeForToken — state validation", () => {
  it("accepts the new state format and forwards its redirectUri", async () => {
    const { sdk, post } = makeSdk();
    const state = b64(JSON.stringify({ u: "https://app.example.com/cb", n: "nonce" }));
    await sdk.exchangeCodeForToken("code-1", state);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toMatchObject({
      code: "code-1",
      grantType: "authorization_code",
      redirectUri: "https://app.example.com/cb",
    });
  });

  it("accepts the legacy plain-redirectUri state format", async () => {
    const { sdk, post } = makeSdk();
    await sdk.exchangeCodeForToken("code-1", b64("https://app.example.com/cb"));
    expect(post.mock.calls[0][1]).toMatchObject({ redirectUri: "https://app.example.com/cb" });
  });

  it("rejects an empty state before any network call", async () => {
    const { sdk, post } = makeSdk();
    await expect(sdk.exchangeCodeForToken("code-1", "")).rejects.toThrow(
      /Invalid OAuth state redirectUri/,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects a state whose redirectUri is not a URL", async () => {
    const { sdk, post } = makeSdk();
    await expect(
      sdk.exchangeCodeForToken("code-1", b64("not a url at all")),
    ).rejects.toThrow(/not a valid URL/);
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects an oversized redirectUri (no unbounded payloads to the exchange)", async () => {
    const { sdk, post } = makeSdk();
    const huge = "https://example.com/" + "a".repeat(2100);
    await expect(
      sdk.exchangeCodeForToken("code-1", b64(JSON.stringify({ u: huge, n: "x" }))),
    ).rejects.toThrow(/Invalid OAuth state redirectUri/);
    expect(post).not.toHaveBeenCalled();
  });
});

// ─── Session token sign / verify ─────────────────────────────────────────────

describe("signSession / verifySession", () => {
  const sdk = new SDKServer({ post: vi.fn() } as unknown as AxiosInstance);
  let savedSecret: string;
  let savedAppId: string;

  beforeEach(() => {
    savedSecret = ENV.cookieSecret;
    savedAppId = ENV.appId;
    ENV.cookieSecret = "test-secret-for-vitest";
    ENV.appId = "app-under-test";
  });

  afterEach(() => {
    ENV.cookieSecret = savedSecret;
    ENV.appId = savedAppId;
  });

  const payload = { openId: "user-1", appId: "app-under-test", name: "Miles" };

  it("round-trips a signed session", async () => {
    const token = await sdk.signSession(payload);
    await expect(sdk.verifySession(token)).resolves.toEqual(payload);
  });

  it("rejects a token bound to a different appId (same signing secret)", async () => {
    const token = await sdk.signSession({ ...payload, appId: "some-other-app" });
    await expect(sdk.verifySession(token)).resolves.toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await sdk.signSession(payload);
    const [h, p, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, openId: "user-2" })).toString(
      "base64url",
    );
    await expect(sdk.verifySession([h, forged, sig].join("."))).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await sdk.signSession(payload, { expiresInMs: -60_000 });
    await expect(sdk.verifySession(token)).resolves.toBeNull();
  });

  it("rejects a missing cookie", async () => {
    await expect(sdk.verifySession(undefined)).resolves.toBeNull();
    await expect(sdk.verifySession(null)).resolves.toBeNull();
    await expect(sdk.verifySession("")).resolves.toBeNull();
  });

  it("rejects a payload with an empty name (documented constraint)", async () => {
    // verifySession requires a non-empty `name`; createSessionToken defaults
    // name to "" when the OAuth profile has none. A user with no display name
    // therefore cannot hold a session — this test documents that coupling so a
    // change to either side is a conscious one.
    const token = await sdk.signSession({ ...payload, name: "" });
    await expect(sdk.verifySession(token)).resolves.toBeNull();
  });
});
