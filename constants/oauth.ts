import * as Linking from "expo-linking";
import * as ReactNative from "react-native";
import * as SecureStore from "expo-secure-store";

// Extract scheme from bundle ID (last segment timestamp, prefixed with "manus")
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const bundleId = "space.manus.salsa.bachata.calendar.t20260417053817";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;

/**
 * Get the API base URL, deriving from current hostname if not set.
 * Metro runs on 8081, API server runs on 3000.
 * URL pattern: https://PORT-sandboxid.region.domain
 */
export function getApiBaseUrl(): string {
  // If API_BASE_URL is set, use it
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }

  // On web, derive from current hostname by replacing port 8081 with 3000
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    // Pattern: 8081-sandboxid.region.domain -> 3000-sandboxid.region.domain
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }

  // Fallback to empty (will use relative URL)
  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";
// Random per-login value embedded in the OAuth `state` and stashed locally, so
// the native callback can confirm the response belongs to a login WE started
// (anti-CSRF). See startOAuthLogin / verifyOAuthStateNonce below.
const STATE_NONCE_KEY = "oauth_state_nonce";

const base64Encode = (value: string): string => {
  if (typeof globalThis.btoa === "function") return globalThis.btoa(value);
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) return BufferImpl.from(value, "utf-8").toString("base64");
  return value;
};

const base64Decode = (value: string): string => {
  if (typeof globalThis.atob === "function") return globalThis.atob(value);
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) return BufferImpl.from(value, "base64").toString("utf-8");
  return value;
};

// state = base64(JSON{ u: redirectUri, n: nonce }). The server (sdk.decodeState)
// reads `u` back as the token-exchange redirectUri, with a legacy fallback for
// the old "base64(redirectUri)" format.
const encodeState = (redirectUri: string, nonce: string): string =>
  base64Encode(JSON.stringify({ u: redirectUri, n: nonce }));

const readStateNonce = (state: string): string | null => {
  try {
    const parsed = JSON.parse(base64Decode(state));
    return parsed && typeof parsed.n === "string" ? parsed.n : null;
  } catch {
    return null;
  }
};

const generateNonce = (): string => {
  const cryptoObj = (globalThis as Record<string, any>).crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback: weaker, but a nonce is still better than a predictable state.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
};

async function storeOAuthNonce(nonce: string): Promise<void> {
  try {
    if (ReactNative.Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.setItem(STATE_NONCE_KEY, nonce);
    } else {
      await SecureStore.setItemAsync(STATE_NONCE_KEY, nonce);
    }
  } catch {
    // Best-effort: if we can't persist the nonce we simply skip verification
    // later rather than block login.
  }
}

async function readOAuthNonce(): Promise<string | null> {
  try {
    if (ReactNative.Platform.OS === "web") {
      return typeof window !== "undefined" ? window.localStorage.getItem(STATE_NONCE_KEY) : null;
    }
    return await SecureStore.getItemAsync(STATE_NONCE_KEY);
  } catch {
    return null;
  }
}

async function clearOAuthNonce(): Promise<void> {
  try {
    if (ReactNative.Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem(STATE_NONCE_KEY);
    } else {
      await SecureStore.deleteItemAsync(STATE_NONCE_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Verify an OAuth callback's `state` nonce against the one we stored when the
 * login started. Returns true when it matches OR when no stored nonce exists
 * (storage was unavailable at login time — we don't lock the user out over our
 * own storage failure). Returns false only on a genuine mismatch — a callback
 * we did not initiate. The stored nonce is cleared either way (single-use).
 *
 * NOTE: only enforceable on native, where the same client both starts the login
 * and handles the deep-link callback. On web the server handles the callback
 * directly; CSRF there would need a server-set state cookie (see docs/security).
 */
export async function verifyOAuthStateNonce(state: string | null | undefined): Promise<boolean> {
  const stored = await readOAuthNonce();
  await clearOAuthNonce();
  if (!stored) return true;
  const incoming = state ? readStateNonce(state) : null;
  return incoming === stored;
}

/**
 * Get the redirect URI for OAuth callback.
 * - Web: uses API server callback endpoint
 * - Native: uses deep link scheme
 */
export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    return `${getApiBaseUrl()}/api/oauth/callback`;
  } else {
    return Linking.createURL("/oauth/callback", {
      scheme: env.deepLinkScheme,
    });
  }
};

export const getLoginUrl = (nonce: string) => {
  const redirectUri = getRedirectUri();
  const state = encodeState(redirectUri, nonce);

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * Start OAuth login flow.
 *
 * On native platforms (iOS/Android), open the system browser directly so
 * the OAuth callback returns via deep link to the app.
 *
 * On web, this simply redirects to the login URL.
 *
 * @returns Always null, the callback is handled via deep link.
 */
export async function startOAuthLogin(): Promise<string | null> {
  // EXPO_PUBLIC_* are inlined at build time. If this bundle was built without the
  // OAuth portal/app-id (the classic Manus-vs-standalone divergence), bail loudly
  // instead of navigating to "undefined/app-auth" and silently doing nothing.
  if (!OAUTH_PORTAL_URL || !APP_ID) {
    console.error(
      "[OAuth] Cannot start login: EXPO_PUBLIC_OAUTH_PORTAL_URL and/or " +
        "EXPO_PUBLIC_APP_ID were not set when this client was built. " +
        "These are inlined at build time — see .env.example.",
    );
    return null;
  }

  // Generate + persist a single-use nonce BEFORE opening the browser so the
  // callback can confirm the response is for a login we started.
  const nonce = generateNonce();
  await storeOAuthNonce(nonce);
  const loginUrl = getLoginUrl(nonce);

  if (ReactNative.Platform.OS === "web") {
    // On web, just redirect
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  const supported = await Linking.canOpenURL(loginUrl);
  if (!supported) {
    console.warn("[OAuth] Cannot open login URL: URL scheme not supported");
    // 可考虑抛出错误或返回错误状态，让调用方处理
    return null;
  }

  try {
    await Linking.openURL(loginUrl);
  } catch (error) {
    console.error("[OAuth] Failed to open login URL:", error);
    // 可考虑抛出错误让调用方处理
  }

  // The OAuth callback will reopen the app via deep link.
  return null;
}
