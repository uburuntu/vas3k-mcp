/**
 * Handles the upstream OAuth handshake with vas3k.club.
 *
 * Routes:
 *   GET  /authorize  → render approval dialog, then redirect to vas3k.club/auth/openid/authorize
 *   POST /authorize  → user clicked "approve", do the redirect
 *   GET  /callback   → exchange `code` for an access_token, hand a token back to the MCP client
 */

import type { AuthRequest } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { UPSTREAM_SCOPE as SCOPE, STATE_TTL_SECONDS, UPSTREAM_TIMEOUT_MS } from "./constants";
import { installMd } from "./install-md";
import { landingHtml } from "./landing";
import type { Env, Props } from "./types";

// ---------- HMAC-signed state ------------------------------------------------
// Replaces KV-stored state — eliminates the regional-eventual-consistency
// race where /callback would arrive at a colo that hadn't yet seen
// /authorize's KV write. We sign `{oauthReqInfo, exp}` with the
// COOKIE_ENCRYPTION_KEY secret using HMAC-SHA-256 and put the whole thing
// in the URL state param. /callback verifies and decodes — no shared
// storage required.

interface SignedState {
  oauthReqInfo: AuthRequest;
  exp: number; // unix epoch seconds
}

function b64urlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const str = atob(s);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signState(state: SignedState, secret: string): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify(state));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, payload));
  return `${b64urlEncode(payload)}.${b64urlEncode(sig)}`;
}

async function verifyState(token: string, secret: string): Promise<SignedState | null> {
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;
  const payload = b64urlDecode(payloadB64);
  const sig = b64urlDecode(sigB64);
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, sig, payload);
  if (!ok) return null;
  let parsed: SignedState;
  try {
    parsed = JSON.parse(new TextDecoder().decode(payload)) as SignedState;
  } catch {
    return null;
  }
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return parsed;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=3600");
  return c.html(landingHtml);
});

// Markdown install guide for AI agents — same content at /install.md
// (intuitive) and /llms.txt (the llmstxt.org convention). Point an agent
// at either URL and it has every URL + snippet it needs.
app.get("/install.md", (c) => {
  c.header("Content-Type", "text/markdown; charset=utf-8");
  c.header("Cache-Control", "public, max-age=300, s-maxage=3600");
  return c.body(installMd);
});
app.get("/llms.txt", (c) => {
  c.header("Content-Type", "text/plain; charset=utf-8");
  c.header("Cache-Control", "public, max-age=300, s-maxage=3600");
  return c.body(installMd);
});

app.get("/authorize", async (c) => {
  // OAuthProvider throws on bad PKCE / unsupported response_type / etc.
  // Hono would render those as 500; OAuth spec wants 400 on malformed
  // authorize requests, so wrap and surface as text/plain.
  let oauthReqInfo: Awaited<ReturnType<typeof c.env.OAUTH_PROVIDER.parseAuthRequest>>;
  try {
    oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  } catch (err) {
    return c.text(`OAuth authorize request rejected: ${(err as Error).message}`, 400);
  }
  if (!oauthReqInfo.clientId) {
    return c.text("Invalid request", 400);
  }

  // PKCE is mandated by MCP 2025-06-18 §2.1.1 and OAuth 2.1. The library
  // verifies code_challenge against code_verifier only when one was sent —
  // reject outright if the client omitted it (defends against legacy
  // PKCE-bypass downgrade where omission silently disables the check).
  if (!oauthReqInfo.codeChallenge) {
    return c.text("PKCE required (code_challenge with method=S256)", 400);
  }

  const client = await c.env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
  const clientName = client?.clientName ?? oauthReqInfo.clientId;
  // The `client_id` is either an opaque registered id, or — with CIMD — a
  // stable HTTPS URL the user can verify. Surface it alongside the name so
  // a user being phished sees the mismatch.
  const clientIdentifier = oauthReqInfo.clientId;
  const redirectUri = oauthReqInfo.redirectUri ?? "(none)";

  // HMAC-sign the MCP-side OAuth request and ship it as the upstream `state`
  // param — no shared KV needed, no regional consistency race.
  const state = await signState(
    {
      oauthReqInfo,
      exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    },
    c.env.COOKIE_ENCRYPTION_KEY,
  );

  return c.html(`<!doctype html><html lang="ru"><head><meta charset="utf-8" /><title>Подтверждение доступа: ${escapeHtml(clientName)}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:34rem;margin:3rem auto;padding:0 1.5rem;color:#1B1B1C;line-height:1.55;background:#FCFDFF}
@media(prefers-color-scheme:dark){body{background:#282c35;color:#DDD}}
h1{margin:0 0 .5rem}
.warn{background:rgba(255,196,85,.18);border-left:4px solid #f7b733;padding:.7rem 1rem;border-radius:8px;margin:1rem 0;font-size:.95rem}
.kv{background:rgba(0,0,0,.05);padding:.5rem .8rem;border-radius:8px;margin:.5rem 0;font-size:.9rem;word-break:break-all}
@media(prefers-color-scheme:dark){.kv{background:rgba(255,255,255,.06)}}
.kv-label{font-weight:600;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;opacity:.7;margin-right:.5rem}
button{font-size:1rem;padding:.7rem 1.3rem;border-radius:8px;border:0;cursor:pointer;margin-right:.5rem;font-weight:600}
.primary{background:#1B1B1C;color:#FCFDFF}
@media(prefers-color-scheme:dark){.primary{background:#FCFDFF;color:#1B1B1C}}
.secondary{background:rgba(0,0,0,.08);color:inherit}
@media(prefers-color-scheme:dark){.secondary{background:rgba(255,255,255,.1)}}
code{background:rgba(0,0,0,.06);padding:.1rem .3rem;border-radius:4px}
@media(prefers-color-scheme:dark){code{background:rgba(255,255,255,.08)}}
ul{padding-left:1.2rem}
form{margin-top:1.5rem}</style></head>
<body>
<h1>Подключить «${escapeHtml(clientName)}» к Клубу?</h1>
<p>Приложение запрашивает доступ к твоему профилю на <a href="https://vas3k.club">vas3k.club</a> через OAuth.</p>

<div class="warn">⚠️ <strong>Имя «${escapeHtml(clientName)}» приложение указало само — никто его не проверял.</strong> Если ты сам это приложение не подключал — закрой вкладку. Проверь идентификатор и redirect URL ниже.</div>

<div class="kv"><span class="kv-label">Client ID</span><code>${escapeHtml(clientIdentifier)}</code></div>
<div class="kv"><span class="kv-label">Redirect URL</span><code>${escapeHtml(redirectUri)}</code></div>

<p>Что приложение сможет:</p>
<ul>
  <li>читать твой профиль и контакты</li>
  <li>читать посты, комментарии и ленту, которые видишь ты</li>
  <li>искать людей и теги</li>
  <li>если приложение использует <code>/mcp-full</code> — ставить лайки, букмарки, дружбы и подписки от твоего имени</li>
</ul>
<p>На следующем экране Клуб формально скажет «приложение не сможет писать посты и комментарии» — это правда: создавать посты или писать комментарии через MCP нельзя. Действия выше (лайки, букмарки и подписки) идут через API и в это ограничение не попадают.</p>
<p>Отозвать доступ можно в любой момент на <a href="https://vas3k.club/apps/">vas3k.club/apps/</a>.</p>
<form method="POST" action="/authorize">
  <input type="hidden" name="state" value="${state}" />
  <button type="submit" class="primary">Подключить и перейти к vas3k.club</button>
  <a href="https://vas3k.club"><button type="button" class="secondary">Отмена</button></a>
</form></body></html>`);
});

app.post("/authorize", async (c) => {
  const form = await c.req.formData();
  const state = form.get("state");
  if (typeof state !== "string") return c.text("Missing state", 400);

  // Verify the state we minted at GET-time is intact (rejects tampered
  // / expired tokens). We don't need its contents here — the upstream
  // will round-trip it back to /callback, which re-verifies.
  const verified = await verifyState(state, c.env.COOKIE_ENCRYPTION_KEY);
  if (!verified) return c.text("State expired or invalid", 400);

  const redirectUri = new URL("/callback", c.env.PUBLIC_BASE_URL).href;
  const upstream = new URL("/auth/openid/authorize", c.env.VAS3K_BASE_URL);
  upstream.searchParams.set("response_type", "code");
  upstream.searchParams.set("client_id", c.env.VAS3K_CLIENT_ID);
  upstream.searchParams.set("redirect_uri", redirectUri);
  upstream.searchParams.set("scope", SCOPE);
  upstream.searchParams.set("state", state);

  return c.redirect(upstream.href, 302);
});

app.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  if (error) return c.text(`vas3k.club returned: ${error}`, 400);
  if (!code || !state) return c.text("Missing code/state", 400);

  const verified = await verifyState(state, c.env.COOKIE_ENCRYPTION_KEY);
  if (!verified) return c.text("State expired or invalid", 400);

  const oauthReqInfo = verified.oauthReqInfo;
  const redirectUri = new URL("/callback", c.env.PUBLIC_BASE_URL).href;

  // exchange code -> tokens at vas3k.club
  const tokenResp = await fetch(new URL("/auth/openid/token", c.env.VAS3K_BASE_URL).href, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${c.env.VAS3K_CLIENT_ID}:${c.env.VAS3K_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: c.env.VAS3K_CLIENT_ID,
    }).toString(),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!tokenResp.ok) {
    const body = await tokenResp.text();
    console.error("[upstream-token-exchange-fail]", {
      status: tokenResp.status,
      body: body.slice(0, 200),
    });
    return c.text("Token exchange failed", 502);
  }
  const tokens = (await tokenResp.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
  };

  // fetch user info to get a stable user id (slug)
  const meResp = await fetch(new URL("/user/me.json", c.env.VAS3K_BASE_URL).href, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!meResp.ok) {
    const body = await meResp.text();
    console.error("[upstream-userinfo-fail]", {
      status: meResp.status,
      body: body.slice(0, 200),
    });
    return c.text("Failed to fetch userinfo", 502);
  }
  const me = (await meResp.json()) as { user?: { slug?: string; full_name?: string } };
  const slug = me.user?.slug ?? "unknown";
  const fullName = me.user?.full_name ?? slug;

  const props: Props = {
    propsVersion: 1,
    slug,
    fullName,
    upstreamAccessToken: tokens.access_token,
    upstreamRefreshToken: tokens.refresh_token,
    scope: tokens.scope ?? SCOPE,
    // The MCP-side scopes the original `oauthReqInfo` requested. Echo back
    // exactly what the client asked for so /mcp-full's write tools can
    // gate on `props.mcpScopes.includes("write")`.
    // `parseAuthRequest` returns [] when the client omitted `scope=`. Default
    // to the full set so write tools work; clients that explicitly want
    // read-only can pass `scope=read` and the /mcp-full guard will hold.
    mcpScopes: oauthReqInfo.scope.length ? oauthReqInfo.scope : ["read", "write"],
  };

  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: slug,
    metadata: { label: fullName },
    scope: oauthReqInfo.scope,
    props: props as unknown as Record<string, unknown>,
  });

  return c.redirect(redirectTo, 302);
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export { app as Vas3kHandler };
