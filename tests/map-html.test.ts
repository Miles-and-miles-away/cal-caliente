import { describe, expect, it } from "vitest";
import { buildMapHtml } from "../lib/map-html";

const REGION = { latitude: 35.6762, longitude: 139.6503 };

describe("buildMapHtml — XSS hardening", () => {
  it("does not allow a crafted title to terminate the <script> block", () => {
    const html = buildMapHtml(
      [
        {
          latitude: 35.6,
          longitude: 139.7,
          title: "</script><script>window.__pwned=true;</script>",
          danceStyle: "salsa",
        },
      ],
      REGION,
    );

    // The opening JSON-data <script> must not be terminated by the payload —
    // the only </script> in the document should be the legitimate one for the
    // markers block and the application-script block. Specifically, the raw
    // attacker payload must not appear verbatim.
    expect(html).not.toContain("</script><script>window.__pwned");
    // The escaped form is what we expect to find inside the JSON.
    expect(html).toContain("\\u003c/script>\\u003cscript>window.__pwned");
  });

  it("escapes < everywhere inside the JSON marker block", () => {
    const html = buildMapHtml(
      [
        {
          latitude: 35.6,
          longitude: 139.7,
          title: "<img src=x onerror=alert(1)>",
          danceStyle: "salsa",
        },
      ],
      REGION,
    );
    // The JSON block itself must contain no literal `<` from user data.
    const jsonMatch = html.match(
      /<script id="markers" type="application\/json">([\s\S]*?)<\/script>/,
    );
    expect(jsonMatch).not.toBeNull();
    expect(jsonMatch![1]).not.toContain("<img");
    expect(jsonMatch![1]).toContain("\\u003cimg");
  });

  it("coerces invalid coordinates so they get filtered at runtime", () => {
    const html = buildMapHtml(
      [
        {
          latitude: "not a number" as any,
          longitude: 139.7,
          title: "Bad",
          danceStyle: "salsa",
        },
      ],
      REGION,
    );
    // The runtime filter is `if (!isFinite(m.lat) || !isFinite(m.lng)) return;`
    // — verify the JSON contains the NaN representation (null in JSON) so
    // that filter trips.
    expect(html).toMatch(/"lat":null/);
  });

  it("does not interpolate region values as strings", () => {
    const html = buildMapHtml([], {
      latitude: "35.6); fetch('//evil')//" as any,
      longitude: 139.7,
    });
    // Region is coerced via Number() so non-numeric input becomes NaN, which
    // serializes as `NaN` in template-string but is harmless because Leaflet
    // will reject it. What matters: the raw payload must not appear.
    expect(html).not.toContain("fetch('//evil')");
  });
});
