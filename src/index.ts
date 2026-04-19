/**
 * Worker entrypoint.
 *
 * Composes Cloudflare's `OAuthProvider` (which makes us an OAuth 2.1 server
 * for MCP clients) with a Hono app that handles the upstream OAuth dance
 * against vas3k.club, plus the `McpAgent`-backed MCP server itself.
 *
 *   MCP client (Claude)
 *        │  Bearer access_token (issued by us)
 *        ▼
 *   OAuthProvider ─── /mcp ───▶ McpAgent (MyMCP) ──▶ vas3k.club JSON API
 *        │                              ▲
 *        │ tokenExchangeCallback        │ this.props.upstreamAccessToken
 *        ▼                              │
 *   refreshUpstreamTokens() ────────────┘
 */

import { env } from "cloudflare:workers";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";

import { MyMCP } from "./mcp";
import { MyMCPFull } from "./mcp-full";
import type { Env, Props } from "./types";
import { Vas3kHandler } from "./vas3k-handler";

/** Default TTL when upstream omits `expires_in`. */
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 3600;
/** Hard cap on accepted upstream `expires_in` to avoid surprise huge values. */
const MAX_ACCESS_TOKEN_TTL_SECONDS = 24 * 3600;
/** Hard request timeout for the upstream refresh call. */
const UPSTREAM_REFRESH_TIMEOUT_MS = 15_000;

async function refreshUpstreamTokens(refreshToken: string) {
  const e = env as unknown as Env;
  const response = await fetch(new URL("/auth/openid/token", e.VAS3K_BASE_URL).href, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${e.VAS3K_CLIENT_ID}:${e.VAS3K_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
    signal: AbortSignal.timeout(UPSTREAM_REFRESH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`vas3k.club refresh failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
  };
}

/**
 * Hardening flags (security review P1-1, P1-2):
 *
 * - `clientIdMetadataDocumentEnabled: true` — let MCP clients use a stable
 *   HTTPS URL as their `client_id` (RFC draft-ietf-oauth-client-id-metadata-document).
 *   Requires the `global_fetch_strictly_public` compatibility flag in
 *   wrangler.jsonc for SSRF protection during metadata fetches.
 * - `allowPlainPKCE: false` — require S256 code challenges; reject `plain`.
 * - `allowImplicitFlow: false` — only authorization-code flow is allowed;
 *   the implicit flow is deprecated and unsafe for confidential props.
 *
 * Note: `disallowPublicClientRegistration` is intentionally NOT set. The MCP
 * spec mandates DCR support, and disabling it locks out MCP Inspector,
 * Claude Desktop, Cursor — basically every MCP client that registers
 * dynamically. The phishing concern from the security review is mitigated
 * by the consent-screen warning in `vas3k-handler.ts` that the client name
 * is self-declared, plus by tracking the `redirect_uri` the user actually
 * sees in the upstream vas3k.club approval flow.
 */
export default new OAuthProvider({
  // Two MCP endpoints sharing one OAuth registration:
  //   /mcp       — read-only (12 tools). Safe default for hosted use.
  //   /mcp-full  — read + 12 write tools (votes, bookmarks, friends,
  //                room subscriptions, profile-tag toggles, etc).
  // Sibling paths (not nested) so OAuthProvider's prefix match can't
  // accidentally route /mcp-full requests through the /mcp handler.
  // McpAgent.serve(path) defaults `binding` to "MCP_OBJECT", so without an
  // explicit binding both classes would route through the same Durable Object
  // and the second class's tools would never run. Pass each its own binding.
  apiHandlers: {
    "/mcp-full": MyMCPFull.serve("/mcp-full", { binding: "MCP_OBJECT_FULL" }) as never,
    "/mcp": MyMCP.serve("/mcp", { binding: "MCP_OBJECT" }) as never,
  },
  defaultHandler: Vas3kHandler as never,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["read"],
  clientIdMetadataDocumentEnabled: true,
  allowPlainPKCE: false,
  allowImplicitFlow: false,

  /**
   * When the MCP client refreshes its token, transparently refresh the
   * upstream vas3k.club token too and rotate it inside `props`.
   */
  tokenExchangeCallback: async (options) => {
    if (options.grantType !== "refresh_token") return;
    const props = options.props as unknown as Props;
    if (!props?.upstreamRefreshToken) return;

    const refreshed = await refreshUpstreamTokens(props.upstreamRefreshToken);
    const nextProps: Props = {
      ...props,
      upstreamAccessToken: refreshed.access_token,
      upstreamRefreshToken: refreshed.refresh_token ?? props.upstreamRefreshToken,
    };

    // Always set accessTokenTTL so the MCP-issued token never outlives the
    // upstream one. Bound the upstream value to avoid surprise huge values
    // (code review P1-6).
    const accessTokenTTL = Math.min(
      refreshed.expires_in ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
      MAX_ACCESS_TOKEN_TTL_SECONDS,
    );

    return {
      accessTokenProps: nextProps as unknown as Record<string, unknown>,
      newProps: nextProps as unknown as Record<string, unknown>,
      accessTokenTTL,
    };
  },
});

// Durable Object classes need to be re-exported so the runtime can find them.
export { MyMCP, MyMCPFull };
