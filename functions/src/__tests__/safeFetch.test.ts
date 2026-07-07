import { isPrivateIp, assertPublicHost } from "../safeFetch";

// Regression: `new URL(...).hostname` keeps brackets on IPv6 literals and Node
// re-encodes IPv4-mapped addresses in hex, so a bare isPrivateIp() call on the
// raw hostname used to return false for loopback/link-local/metadata and defeat
// the SSRF guard. assertPublicHost must reject all of them.

describe("isPrivateIp", () => {
  it("flags IPv4 private, loopback, link-local, and metadata ranges", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.5.5", "192.168.1.1", "0.0.0.0"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
  });

  it("flags bare IPv6 loopback/ULA/link-local", () => {
    for (const ip of ["::1", "fd00::1", "fe80::1"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it("flags IPv4-mapped IPv6 metadata in both dotted and hex form", () => {
    expect(isPrivateIp("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateIp("::ffff:a9fe:a9fe")).toBe(true); // hex form Node emits
  });
});

describe("assertPublicHost — bracketed IPv6 literals", () => {
  const blocked = ["[::1]", "[::ffff:a9fe:a9fe]", "[fd00::1]", "[fe80::1]", "[::]"];
  for (const host of blocked) {
    it(`rejects ${host}`, async () => {
      await expect(assertPublicHost(host)).rejects.toThrow();
    });
  }

  it("still allows a public IPv6 literal", async () => {
    await expect(assertPublicHost("[2606:4700:4700::1111]")).resolves.toBeUndefined();
  });
});
