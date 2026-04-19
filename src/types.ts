import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

/**
 * Worker-wide bindings (vars + secrets + KV + Durable Object).
 */
export interface Env {
  VAS3K_BASE_URL: string;
  VAS3K_CLIENT_ID: string;
  VAS3K_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  MCP_OBJECT: DurableObjectNamespace;
  MCP_OBJECT_FULL: DurableObjectNamespace;
}

/**
 * Per-session context the OAuth provider hands to McpAgent as `this.props`.
 * Encrypted into the bearer token issued to the MCP client.
 *
 * Only the upstream `access_token` and `refresh_token` go in here — the
 * client_id/secret stay in env vars and never touch token storage.
 */
export interface Props {
  /** Schema version of this Props object. See CURRENT_PROPS_VERSION. */
  propsVersion: number;
  slug: string;
  fullName: string;
  upstreamAccessToken: string;
  upstreamRefreshToken?: string;
  scope: string;
  [key: string]: unknown; // satisfy OAuthProvider's loose typing
}
