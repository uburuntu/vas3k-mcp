<p align="center">
  <img src="public/img/readme-hero.webp" alt="vas3k-mcp — MCP-сервер для Клуба" width="900" />
</p>

# vas3k-mcp

A remote [Model Context Protocol](https://modelcontextprotocol.io) server for
the [vas3k.club](https://vas3k.club) community, deployed on
[Cloudflare Workers](https://developers.cloudflare.com/workers/). It exposes
the club's JSON API (profiles, posts, comments, search, feed) as MCP tools and
delegates user authentication to the club's own OAuth2 / OpenID Connect
provider.

> Built with [`agents`](https://github.com/cloudflare/agents) (`McpAgent`),
> [`@cloudflare/workers-oauth-provider`](https://github.com/cloudflare/workers-oauth-provider)
> (dual-OAuth bridge), and [`hono`](https://hono.dev/) (HTTP routing).

## Two ways to use it

There's a public deployment at **`https://vas3k-mcp.rmbk.me`** that I run for
my own use and don't promise any uptime / SLA / scale on. If you find it
useful, great; if you'd rather control the infra, deploying your own copy
takes ~10 minutes on Cloudflare's free tier.

| | **Public deployment** | **Your own copy** |
| --- | --- | --- |
| Setup | Paste a URL into your MCP client. Done. | Fork → register a vas3k.club app → push 3 secrets → `make deploy`. |
| Cost | Free | Free (Cloudflare's generous tier) |
| Trust | You trust *me* (the repo author) to not poke at refresh tokens. They're encrypted with a per-deployment key in KV, but encryption isn't a substitute for trust. | Only you. Tokens never leave your account. |
| Reliability | Best-effort. One shared CF deployment, single shared rate-limit budget vs vas3k.club. May disappear without notice. | Yours. Independent rate-limit. |
| Updates | Auto-deployed from `main`. | You `git pull && make deploy`. |

### Public deployment

Add to your MCP client config:

```jsonc
{
  "mcpServers": {
    "vas3k": {
      "url": "https://vas3k-mcp.rmbk.me/mcp"
    }
  }
}
```

On first connect the client opens a browser → vas3k.club asks you to sign in
and approve → you're back with a working session. Revoke any time at
<https://vas3k.club/apps/>.

### Your own copy

See [Self-host on Cloudflare Workers](#self-host-on-cloudflare-workers) below.

## Tools

The full read + write tool inventory lives on the landing page
(<https://vas3k-mcp.rmbk.me/#умеет>) and in the agent-friendly Markdown
guide at <https://vas3k-mcp.rmbk.me/install.md>. Read tools on `/mcp`,
write tools on `/mcp-full`.

## Self-host on Cloudflare Workers

Free tier on Cloudflare is generous; you'll likely never pay for this.

### 1. Clone & install

```sh
git clone https://github.com/uburuntu/vas3k-mcp
cd vas3k-mcp
make install
```

### 2. Provision Cloudflare resources

```sh
npx wrangler login
npx wrangler kv namespace create vas3k-mcp-oauth
```

Paste the returned KV id into `wrangler.jsonc` (replace the existing one).

### 3. Register an OAuth app on vas3k.club

Sign in to vas3k.club, then go to <https://vas3k.club/apps/create/>:

| Field | Value |
| --- | --- |
| Название приложения | `Vas3k MCP (your-handle)` |
| Описание | _short user-facing blurb that appears on the OAuth approval page — see the hosted app at https://vas3k.club/apps/ for a reference style_ |
| URL вашего сайта или бота | `https://github.com/<you>/vas3k-mcp` |
| Разрешённые Callback URL | `https://vas3k-mcp.<your-cf-subdomain>.workers.dev/callback, http://127.0.0.1:8788/callback` |

The second URL covers `make dev`. Find your `<your-cf-subdomain>` with:

```sh
curl -H "Authorization: Bearer $(grep oauth_token ~/Library/Preferences/.wrangler/config/default.toml | cut -d'"' -f2)" \
  "https://api.cloudflare.com/client/v4/accounts/<account-id>/workers/subdomain"
```

(account id from `npx wrangler whoami`). Or just deploy once with placeholders,
note the printed URL, edit the app.

After saving you'll see **Client ID** and **Client Secret** on the app page —
needed in step 4. (The page also lists a **Service Token**; we don't use it,
that's a different auth shape.)

### 4. Push secrets

```sh
# Interactive prompts — values won't land in your shell history.
npx wrangler secret put VAS3K_CLIENT_ID
npx wrangler secret put VAS3K_CLIENT_SECRET
# Generate a fresh 32-byte hex key and paste it into the prompt below
# (don't pipe via stdin if you care about not leaking it through history):
openssl rand -hex 32
npx wrangler secret put COOKIE_ENCRYPTION_KEY
```

`COOKIE_ENCRYPTION_KEY` encrypts the per-session `props` (vas3k.club access +
refresh tokens) inside the bearer tokens this worker hands to MCP clients.
Treat it like a password; rotating it logs everyone out.

### 5. Deploy

```sh
make deploy
```

The first deploy prints your Worker URL. Copy it back into the vas3k.club app
settings as the redirect URI, then redeploy.

## Local development

```sh
cp .dev.vars.example .dev.vars   # fill in client id/secret/cookie key
make dev                         # http://127.0.0.1:8788
```

If your vas3k.club app already lists `http://127.0.0.1:8788/callback` as one
of its callbacks (recommended in step 3 above), reuse the same `CLIENT_ID` /
`CLIENT_SECRET` for `.dev.vars`. Otherwise register a separate dev-only app.

## Environment

| Var                     | Where    | Purpose                                                      |
| ----------------------- | -------- | ------------------------------------------------------------ |
| `VAS3K_BASE_URL`        | `vars`   | vas3k.club host (default `https://vas3k.club`)                 |
| `PUBLIC_BASE_URL`       | `vars`   | This worker's public URL — used to build the OAuth redirect_uri |
| `VAS3K_CLIENT_ID`       | secret   | OAuth client id from your vas3k.club app                       |
| `VAS3K_CLIENT_SECRET`   | secret   | OAuth client secret from your vas3k.club app                   |
| `COOKIE_ENCRYPTION_KEY` | secret   | 32-byte hex — encrypts `props` inside MCP-issued tokens        |
| `OAUTH_KV`              | binding  | KV (dashboard title `vas3k-mcp-oauth`); binding name hardcoded by the lib |
| `MCP_OBJECT`            | binding  | Durable Object for the `/mcp` (read-only) `McpAgent`           |
| `MCP_OBJECT_FULL`       | binding  | Durable Object for the `/mcp-full` (read+write) `McpAgent`     |

## Architecture

```
   MCP client (Claude Desktop / Code / Cursor / ChatGPT / …)
        │  Bearer token issued by us (props HMAC-encrypted into it)
        ▼
   ┌─────────────────────── Worker ────────────────────────────┐
   │ OAuthProvider (@cloudflare/workers-oauth-provider)        │
   │   ├── /authorize, /token, /register   (MCP-side OAuth)    │
   │   ├── /authorize, /callback           (Hono → vas3k)      │
   │   ├── /mcp        →  MyMCP     : McpAgent  (read tools)   │
   │   └── /mcp-full   →  MyMCPFull : McpAgent  (+ write tools)│
   │ Static: /, /favicon.*, /img/*, /site.webmanifest          │
   └───────────────────────────────────────────────────────────┘
                                │
                                ▼
                       vas3k.club JSON API
```

The Worker plays two OAuth roles at once:

- **Provider** to MCP clients — they OAuth with the worker, receive a bearer.
- **Client** to vas3k.club — the worker exchanges its own credentials for
  upstream tokens during `/callback`. The upstream access + refresh tokens are
  stored as encrypted `props` inside the MCP-side bearer.

When the MCP client refreshes its token, `tokenExchangeCallback` transparently
refreshes the upstream vas3k.club token too, so sessions stay alive across
upstream-token expiry without a re-auth round-trip.

## CI / CD

- **`.github/workflows/ci.yml`** — on every PR and main push: biome lint,
  TypeScript type-check, vitest unit tests, `wrangler deploy --dry-run`.
  10-minute job timeout.
- **`.github/workflows/contract.yml`** — PR / main / weekly cron / dispatch:
  spins up the real vas3k.club Django backend and runs zod-schema contract
  tests against it. The cron is gated to the canonical repo so forks don't
  burn minutes on it.
- **`.github/workflows/deploy.yml`** — on main push (only when `src/`,
  `wrangler.jsonc`, the lockfile, or the workflow itself change — README-only
  commits no longer redeploy) plus `workflow_dispatch`: deploy to Cloudflare
  via `cloudflare/wrangler-action`. 15-minute job timeout. Requires repo
  secrets `CLOUDFLARE_API_TOKEN` (Workers · Edit) and `CLOUDFLARE_ACCOUNT_ID`.
- **`.github/dependabot.yml`** — weekly SHA bumps for `github-actions` and
  weekly grouped minor+patch bumps for npm.

Third-party actions (`cloudflare/wrangler-action`, `pnpm/action-setup`,
`astral-sh/setup-uv`) are pinned to a full commit SHA with a version comment
so a tag re-point can't ship attacker-controlled code into a job that holds
`CLOUDFLARE_API_TOKEN`. GitHub-owned `actions/*` are left at floating major
tags. Dependabot opens PRs for the pinned SHAs weekly.

### Required reviewers on the `production` environment

Declaring `environment: production` in the workflow only binds the job to the
environment so it can read environment secrets — it does **not** by itself
require a human to approve the deploy. To enforce that:

1. Repo Settings → Environments → `production` (create it if missing).
2. Tick **Required reviewers**, add at least one user/team, and enable
   **Prevent self-review**.
3. Optionally set **Deployment branches** to `main` only and a small **Wait
   timer** so a bad merge can be cancelled before it ships.

Without that rule, every qualifying push to `main` ships to prod immediately.

### Self-hosters: DCR is open, hardened by CIMD + consent UI

The worker keeps RFC 7591 dynamic client registration **enabled** (the MCP
spec requires it; disabling it locks out MCP Inspector / Claude Desktop /
Cursor). To keep the phishing surface manageable, the worker sets
`clientIdMetadataDocumentEnabled: true` (so well-behaved clients can use a
stable HTTPS URL as their `client_id`) and the `/authorize` consent screen
explicitly warns that the application name is self-declared by the
registering client and surfaces both the `client_id` and `redirect_uri`
verbatim. If you want to lock down further on a private deploy, set
`disallowPublicClientRegistration: true` in `src/index.ts` and pre-register
each client via `OAuthProvider.createClient`.

## Project meta

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — adding a tool, dev loop, PR checklist
- [`CHANGELOG.md`](./CHANGELOG.md) — Keep-a-Changelog formatted release log
- [`SECURITY.md`](./SECURITY.md) — vulnerability disclosure
- [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — Contributor Covenant 2.1
- [`docs/runbook.md`](./docs/runbook.md) — operator runbook (token rotation, KV reset, rollback)

## License

[MIT](./LICENSE).
