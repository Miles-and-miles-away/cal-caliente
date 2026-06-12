import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "../server/_core/env";
import { storageGet, storagePut } from "../server/storage";

// storage.ts talks to the Forge proxy over fetch — stub it globally and assert
// on the requests it would have made.
const fetchMock = vi.fn();

let savedUrl: string;
let savedKey: string;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  savedUrl = ENV.forgeApiUrl;
  savedKey = ENV.forgeApiKey;
  ENV.forgeApiUrl = "https://forge.example.com/api";
  ENV.forgeApiKey = "test-api-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  ENV.forgeApiUrl = savedUrl;
  ENV.forgeApiKey = savedKey;
});

const okJson = (body: unknown) =>
  ({ ok: true, json: async () => body }) as unknown as Response;

describe("storagePut", () => {
  it("throws a named error when storage credentials are missing", async () => {
    ENV.forgeApiUrl = "";
    await expect(storagePut("a.jpg", "data")).rejects.toThrow(/Storage proxy credentials missing/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads with a Bearer header and returns the proxy's signed URL", async () => {
    fetchMock.mockResolvedValue(okJson({ url: "https://cdn.example/x.jpg" }));

    const result = await storagePut("submissions/event.jpg", Buffer.from("img"), "image/jpeg");

    expect(result.url).toBe("https://cdn.example/x.jpg");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://forge.example.com/api/v1/storage/upload");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer test-api-key" });
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("appends a collision-avoidance hash while preserving the extension", async () => {
    fetchMock.mockResolvedValue(okJson({ url: "https://cdn.example/x" }));
    const { key } = await storagePut("submissions/event.jpg", "data");
    expect(key).toMatch(/^submissions\/event_[0-9a-f]{8}\.jpg$/);
  });

  it("hashes extensionless keys, ignoring dots in earlier path segments", async () => {
    fetchMock.mockResolvedValue(okJson({ url: "https://cdn.example/x" }));
    const { key } = await storagePut("v1.2/flyer", "data");
    // The dot lives in the directory segment, not the filename — suffix goes at
    // the end instead of splitting "v1" / "2/flyer".
    expect(key).toMatch(/^v1\.2\/flyer_[0-9a-f]{8}$/);
  });

  it("strips leading slashes so keys can't escape the bucket prefix", async () => {
    fetchMock.mockResolvedValue(okJson({ url: "https://cdn.example/x" }));
    const { key } = await storagePut("//submissions/event.jpg", "data");
    expect(key.startsWith("/")).toBe(false);
    const [url] = fetchMock.mock.calls[0];
    expect(new URL(String(url)).searchParams.get("path")).toBe(key);
  });

  it("throws with status and body detail on a failed upload", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "key expired",
    } as unknown as Response);

    await expect(storagePut("a.jpg", "data")).rejects.toThrow(
      /Storage upload failed \(403 Forbidden\): key expired/,
    );
  });
});

describe("storageGet", () => {
  it("requests a signed download URL for the normalized key", async () => {
    fetchMock.mockResolvedValue(okJson({ url: "https://cdn.example/signed" }));

    const result = await storageGet("/submissions/event.jpg");

    expect(result).toEqual({ key: "submissions/event.jpg", url: "https://cdn.example/signed" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/v1/storage/downloadUrl");
    expect(new URL(String(url)).searchParams.get("path")).toBe("submissions/event.jpg");
    expect(init.headers).toEqual({ Authorization: "Bearer test-api-key" });
  });
});
