import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 *
 * Additionally, we need a custom fetch function to properly serialize
 * GET request query parameters with superjson, as httpBatchLink doesn't
 * do this automatically.
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        // tRPC v11: transformer MUST be inside httpBatchLink, not at root
        transformer: superjson,
        async headers() {
          const token = await Auth.getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // Custom fetch to:
        // 1. Include credentials for cookie-based auth
        // 2. Properly serialize input parameters with superjson for GET requests
        fetch(urlOrRequest: any, options?: RequestInit) {
          let urlStr = typeof urlOrRequest === "string" ? urlOrRequest : urlOrRequest.url;

          // Parse the URL to check if there's an input parameter
          try {
            const urlObj = new URL(urlStr, "http://localhost");
            const inputParam = urlObj.searchParams.get("input");

            if (inputParam) {
              try {
                // Try to parse the input parameter
                const parsed = JSON.parse(decodeURIComponent(inputParam));

                // If it's not already in superjson format (no "json" key), wrap it
                if (parsed && typeof parsed === "object" && !("json" in parsed)) {
                  const serialized = superjson.stringify(parsed);
                  urlObj.searchParams.set("input", serialized);
                  urlStr = urlObj.toString().replace("http://localhost", "");
                }
              } catch (e) {
                // If parsing fails, just use the original URL
              }
            }
          } catch (e) {
            // If URL parsing fails, just use the original URL
          }

          return fetch(urlStr, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}
