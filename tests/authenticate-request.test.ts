import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";
import type { Request } from "express";
import { COOKIE_NAME } from "../shared/const.js";

// sdk.authenticateRequest touches the db through `import * as db` — mock the
// two functions it uses; everything else (JWT sign/verify) runs for real.
const mockGetUserByOpenId = vi.fn();
const mockUpsertUser = vi.fn();

vi.mock("../server/db", () => ({
  getUserByOpenId: mockGetUserByOpenId,
  upsertUser: mockUpsertUser,
}));

const { SDKServer } = await import("../server/_core/sdk");
const { ENV } = await import("../server/_core/env");

const post = vi.fn();
const sdk = new SDKServer({ post } as unknown as AxiosInstance);

let savedSecret: string;
let savedAppId: string;

beforeEach(() => {
  vi.clearAllMocks();
  savedSecret = ENV.cookieSecret;
  savedAppId = ENV.appId;
  ENV.cookieSecret = "test-secret-for-vitest";
  ENV.appId = "app-under-test";
  mockUpsertUser.mockResolvedValue(undefined);
});

afterEach(() => {
  ENV.cookieSecret = savedSecret;
  ENV.appId = savedAppId;
});

const knownUser = {
  id: 7,
  openId: "user-1",
  name: "Miles",
  role: "user",
  lastSignedIn: new Date(), // fresh — within the hourly refresh window
};

function makeToken() {
  return sdk.signSession({ openId: "user-1", appId: "app-under-test", name: "Miles" });
}

function reqWith(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe("authenticateRequest — session sources", () => {
  it("authenticates via Bearer token and returns the db user", async () => {
    mockGetUserByOpenId.mockResolvedValue(knownUser);
    const user = await sdk.authenticateRequest(
      reqWith({ authorization: `Bearer ${await makeToken()}` }),
    );
    expect(user).toBe(knownUser);
    expect(post).not.toHaveBeenCalled(); // no OAuth round-trip for a known user
  });

  it("authenticates via the session cookie", async () => {
    mockGetUserByOpenId.mockResolvedValue(knownUser);
    const user = await sdk.authenticateRequest(
      reqWith({ cookie: `${COOKIE_NAME}=${await makeToken()}` }),
    );
    expect(user).toBe(knownUser);
  });

  it("prefers the Bearer token over the cookie when both are present", async () => {
    mockGetUserByOpenId.mockResolvedValue(knownUser);
    // The cookie is garbage; only the Bearer token verifies. Success proves
    // the header wins.
    const user = await sdk.authenticateRequest(
      reqWith({
        authorization: `Bearer ${await makeToken()}`,
        cookie: `${COOKIE_NAME}=not-a-jwt`,
      }),
    );
    expect(user).toBe(knownUser);
  });

  it("rejects a request with no usable session", async () => {
    await expect(sdk.authenticateRequest(reqWith({}))).rejects.toThrow(/Invalid session cookie/);
    await expect(
      sdk.authenticateRequest(reqWith({ cookie: `${COOKIE_NAME}=tampered.jwt.value` })),
    ).rejects.toThrow(/Invalid session cookie/);
    expect(mockGetUserByOpenId).not.toHaveBeenCalled();
  });
});

describe("authenticateRequest — first-login user sync", () => {
  it("syncs an unknown user from the OAuth server, then returns the stored row", async () => {
    const synced = { ...knownUser, id: 99 };
    mockGetUserByOpenId.mockResolvedValueOnce(undefined).mockResolvedValueOnce(synced);
    post.mockResolvedValue({
      data: { openId: "user-1", name: "Miles", email: "m@example.com", platform: "google" },
    });

    const user = await sdk.authenticateRequest(
      reqWith({ authorization: `Bearer ${await makeToken()}` }),
    );

    expect(user).toBe(synced);
    expect(mockUpsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "user-1", name: "Miles", email: "m@example.com" }),
    );
  });

  it("rejects when the OAuth sync itself fails", async () => {
    mockGetUserByOpenId.mockResolvedValue(undefined);
    post.mockRejectedValue(new Error("oauth server down"));
    await expect(
      sdk.authenticateRequest(reqWith({ authorization: `Bearer ${await makeToken()}` })),
    ).rejects.toThrow(/Failed to sync user info/);
  });

  it("rejects when the user is still missing after a successful sync", async () => {
    mockGetUserByOpenId.mockResolvedValue(undefined);
    post.mockResolvedValue({ data: { openId: "user-1", name: "Miles" } });
    await expect(
      sdk.authenticateRequest(reqWith({ authorization: `Bearer ${await makeToken()}` })),
    ).rejects.toThrow(/User not found/);
  });
});

describe("authenticateRequest — lastSignedIn refresh throttle", () => {
  it("refreshes lastSignedIn when it is more than an hour stale", async () => {
    const stale = { ...knownUser, lastSignedIn: new Date(Date.now() - 2 * 60 * 60 * 1000) };
    mockGetUserByOpenId.mockResolvedValue(stale);

    await sdk.authenticateRequest(reqWith({ authorization: `Bearer ${await makeToken()}` }));

    expect(mockUpsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "user-1", lastSignedIn: expect.any(Date) }),
    );
  });

  it("skips the write when lastSignedIn is fresh (no write amplification on reads)", async () => {
    mockGetUserByOpenId.mockResolvedValue(knownUser);
    await sdk.authenticateRequest(reqWith({ authorization: `Bearer ${await makeToken()}` }));
    expect(mockUpsertUser).not.toHaveBeenCalled();
  });

  it("treats a null lastSignedIn as maximally stale and refreshes it", async () => {
    mockGetUserByOpenId.mockResolvedValue({ ...knownUser, lastSignedIn: null });
    await sdk.authenticateRequest(reqWith({ authorization: `Bearer ${await makeToken()}` }));
    expect(mockUpsertUser).toHaveBeenCalled();
  });
});
