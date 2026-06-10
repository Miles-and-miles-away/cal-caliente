import { afterEach, describe, expect, it, vi } from "vitest";
import { validateEnv } from "../server/_core/env";

type ServerEnv = {
  appId: string;
  cookieSecret: string;
  databaseUrl: string;
  oAuthServerUrl: string;
  ownerOpenId: string;
  isProduction: boolean;
  forgeApiUrl: string;
  forgeApiKey: string;
};

// A fully-configured env; tests override individual fields to simulate gaps.
function makeEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    appId: "app-id",
    cookieSecret: "secret",
    databaseUrl: "mysql://user:pw@host:3307/db",
    oAuthServerUrl: "https://oauth.example",
    ownerOpenId: "owner-open-id",
    isProduction: false,
    forgeApiUrl: "https://forge.example",
    forgeApiKey: "forge-key",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateEnv", () => {
  it("passes silently when every required + optional var is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => validateEnv(makeEnv())).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it("throws in production when a required var is missing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      validateEnv(makeEnv({ databaseUrl: "", isProduction: true })),
    ).toThrow(/DATABASE_URL/);
  });

  it("names every missing required var in the thrown message", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      validateEnv(
        makeEnv({
          databaseUrl: "",
          cookieSecret: "",
          oAuthServerUrl: "",
          appId: "",
          isProduction: true,
        }),
      ),
    ).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET[\s\S]*OAUTH_SERVER_URL[\s\S]*VITE_APP_ID/);
  });

  it("warns but does NOT throw in development when a required var is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      validateEnv(makeEnv({ databaseUrl: "", isProduction: false })),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/DATABASE_URL/));
  });

  it("warns about missing OPTIONAL vars without throwing — even in production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      validateEnv(makeEnv({ forgeApiKey: "", ownerOpenId: "", isProduction: true })),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/BUILT_IN_FORGE_API_KEY/));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/OWNER_OPEN_ID/));
  });
});
