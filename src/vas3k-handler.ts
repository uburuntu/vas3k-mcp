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

import { landingHtml } from "./landing";
import type { Env, Props } from "./types";

const STATE_TTL_SECONDS = 600;
const SCOPE = "openid contact";
/** Hard request timeout for upstream OAuth calls during the /callback flow. */
const UPSTREAM_TIMEOUT_MS = 15_000;

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=3600");
  return c.html(landingHtml);
});

app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  if (!oauthReqInfo.clientId) {
    return c.text("Invalid request", 400);
  }

  const client = await c.env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
  const clientName = client?.clientName ?? oauthReqInfo.clientId;
  // The `client_id` is either an opaque registered id, or — with CIMD — a
  // stable HTTPS URL the user can verify. Surface it alongside the name so
  // a user being phished sees the mismatch.
  const clientIdentifier = oauthReqInfo.clientId;
  const redirectUri = oauthReqInfo.redirectUri ?? "(none)";

  // store the original MCP-client OAuth request keyed by an opaque state value
  const state = crypto.randomUUID();
  await c.env.OAUTH_KV.put(`state:${state}`, JSON.stringify(oauthReqInfo), {
    expirationTtl: STATE_TTL_SECONDS,
  });

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

<div class="warn">⚠️ <strong>Имя приложения «${escapeHtml(clientName)}» оно само себе придумало.</strong> Если ты не запускал/-а это приложение специально — закрой эту вкладку. Проверь идентификатор и redirect URL ниже.</div>

<div class="kv"><span class="kv-label">Client ID</span><code>${escapeHtml(clientIdentifier)}</code></div>
<div class="kv"><span class="kv-label">Redirect URL</span><code>${escapeHtml(redirectUri)}</code></div>

<p>Что приложение сможет:</p>
<ul>
  <li>читать твой профиль и контакты</li>
  <li>читать посты, комментарии и ленту, которые видишь ты</li>
  <li>искать людей и теги</li>
</ul>
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

  const stored = await c.env.OAUTH_KV.get(`state:${state}`);
  if (!stored) return c.text("State expired or invalid", 400);

  const redirectUri = new URL("/callback", c.req.url).href;
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

  const stored = await c.env.OAUTH_KV.get(`state:${state}`);
  if (!stored) return c.text("State expired or invalid", 400);
  await c.env.OAUTH_KV.delete(`state:${state}`);

  const oauthReqInfo = JSON.parse(stored) as AuthRequest;
  const redirectUri = new URL("/callback", c.req.url).href;

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
    return c.text(`Token exchange failed: ${await tokenResp.text()}`, 502);
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
    return c.text(`Failed to fetch /user/me.json: ${await meResp.text()}`, 502);
  }
  const me = (await meResp.json()) as { user?: { slug?: string; full_name?: string } };
  const slug = me.user?.slug ?? "unknown";
  const fullName = me.user?.full_name ?? slug;

  const props: Props = {
    slug,
    fullName,
    upstreamAccessToken: tokens.access_token,
    upstreamRefreshToken: tokens.refresh_token,
    scope: tokens.scope ?? SCOPE,
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
