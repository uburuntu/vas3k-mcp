# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`vas3k-mcp` is a remote MCP (Model Context Protocol) server for vas3k.club, deployed as a Cloudflare Worker at `https://vas3k-mcp.rmbk.me`. It exposes the club's JSON API as MCP tools and acts as a dual OAuth bridge — OAuth provider to MCP clients (Claude Desktop, Cursor, MCP Inspector, …), OAuth client to vas3k.club's OpenID Connect endpoint.

## Common commands

Use the Makefile — every target wraps a `pnpm` invocation.

```sh
make help              # list every target with its description
make install           # pnpm install
make hooks             # one-time per clone: enable .githooks/pre-push (runs `make ci`)
make dev               # wrangler dev on http://127.0.0.1:8788
make ci                # typecheck + lint + test (the pre-push hook also runs this)
make deploy            # ci → wrangler deploy (Cloudflare prod)
make format            # biome --write
make images            # re-encode source PNGs at repo root → public/img/*.{webp,png}
```

Run a single test: `pnpm exec vitest run path/to/file.test.ts -t "test name substring"`.

Contract tests (`test/contract/`) auto-skip without `VAS3K_SERVICE_TOKEN`. To run them locally, bring up the upstream Django stack from a `vas3k/vas3k.club` clone via `docker compose up`, then run the bootstrap script that lives here:

```sh
python3 manage.py shell -c "$(cat /path/to/vas3k-mcp/ci/bootstrap.py)"
# script prints SERVICE_TOKEN, POST_SLUG, ROOM_SLUG, FRIEND_SLUG sentinel lines
export VAS3K_BASE_URL=http://localhost:8000 VAS3K_SERVICE_TOKEN=… VAS3K_TEST_POST_SLUG=… VAS3K_TEST_ROOM_SLUG=… VAS3K_TEST_FRIEND_SLUG=…
make ci
```

## Architecture

**Dual OAuth bridge.** The worker is simultaneously an OAuth 2.1 *provider* (to MCP clients) and an OAuth *client* (to vas3k.club). Read `src/index.ts` first — it composes everything via `OAuthProvider` from `@cloudflare/workers-oauth-provider`:

- `apiHandlers` map two MCP endpoints to two `McpAgent` subclasses (see *Two endpoints* below).
- `defaultHandler` is the `Hono` app in `src/vas3k-handler.ts` — handles `/`, `/authorize` (consent screen + redirect to vas3k.club), `/callback` (token exchange).
- `tokenExchangeCallback` transparently refreshes the upstream vas3k.club token whenever the MCP client refreshes its own token. Calls `refreshUpstreamTokens` (exported for test access).

**Two endpoints, two McpAgent classes:**

- `MyMCP` (`src/mcp.ts`) — read-only, mounted at `/mcp`, 12 tools. Defines protected `client()` and `wrap()` helpers used by both classes.
- `MyMCPFull` (`src/mcp-full.ts`) — extends `MyMCP`, mounted at `/mcp-full`. Adds 11 write tools via `writeClient()`, which checks `props.mcpScopes.includes("write")` before delegating to `client()`.

Two non-obvious foot-guns in this setup, both documented in `src/index.ts`:
1. `OAuthProvider`'s path matching is `pathname.startsWith(route)` and iterates insertion order — so `/mcp-full` (the longer route) **must come first** in the `apiHandlers` map, otherwise `/mcp` swallows it.
2. `McpAgent.serve(path)` defaults `binding: "MCP_OBJECT"`. Each subclass needs its DO binding passed explicitly (`MyMCPFull.serve("/mcp-full", { binding: "MCP_OBJECT_FULL" })`), or both endpoints route to the same Durable Object and one set of tools never runs.

**KV binding name is hardcoded.** `@cloudflare/workers-oauth-provider` looks up `env.OAUTH_KV` by name — that binding name in `wrangler.jsonc` cannot be renamed, only the dashboard title (`vas3k-mcp-oauth`) is configurable. Comment in `wrangler.jsonc` documents this.

**HMAC-signed state, not KV-stored.** `src/vas3k-handler.ts` signs `{oauthReqInfo, exp}` with `COOKIE_ENCRYPTION_KEY` via SubtleCrypto and ferries the whole thing through the upstream `state` query param. There's no KV write/read for state — eliminates the regional KV consistency race during OAuth callbacks.

**Props schema versioning.** `Props` (in `src/types.ts`) carries a `propsVersion` field; `tokenExchangeCallback` refuses to refresh tokens whose `propsVersion` doesn't match `CURRENT_PROPS_VERSION` in `src/index.ts`. Bump the constant when you add a required field — see the runbook section "Bumping `Props` shape".

**Vas3kClient hardening** (`src/vas3k-client.ts`):
- Always `redirect: "manual"` — upstream returns 302→HTML on post-type mismatch, so following silently delivers HTML to the LLM.
- 15s `AbortSignal.timeout` on every fetch.
- Rejects non-JSON responses on JSON-typed call sites.
- Slug / UUID / Telegram-id input validation before the URL is built.
- Two auth modes: `accessToken` (`Authorization: Bearer`) preferred; `serviceToken` (`X-Service-Token`) for contract tests that can't run the OAuth dance.

## Adding a new tool

The recipe lives in `CONTRIBUTING.md`. Short version, four files per tool:

1. `src/vas3k-client.ts` — add a method using the shared `request()` helper.
2. `src/mcp.ts` (read) or `src/mcp-full.ts` (write — make sure upstream view is `@api(require_auth=True)`, otherwise Bearer auth doesn't reach it).
3. `src/landing.ts` — add a tile to the appropriate group, bump the count in the section header.
4. `test/contract/vas3k-club.test.ts` — add a contract test if the response shape can drift.

## Reference clone

`reference/` is a gitignored clone of `vas3k/vas3k.club` kept for source lookups. Use it to verify upstream URL paths, model field names, decorator usage (`@api(require_auth=True)` is Bearer-callable; `@require_auth` is session-cookie only and **cannot** be reached by an OAuth-Bearer request — this is why post/comment writing is impossible via this MCP). When you need to verify upstream behavior, grep `reference/` rather than guessing.

## CI workflows

Three GitHub Actions live in `.github/workflows/`:

- `ci.yml` — fast lane: typecheck, lint, vitest, `wrangler deploy --dry-run`. Mirrors `make ci`. Runs on every PR + main push.
- `contract.yml` — slow lane: spins up the actual vas3k.club Django stack (postgres + redis + Django) on the runner via `ci/bootstrap.py`, then runs the contract suite with `VAS3K_TEST_*` env vars wired in. Runs on PR src/test changes, on every main push, and weekly Mon 03:17 UTC. Cron is gated to the canonical repo via `if: github.repository == 'uburuntu/vas3k-mcp'`.
- `deploy.yml` — main-push autodeploy via `cloudflare/wrangler-action`. Path-filtered (README-only commits don't redeploy). Bound to the GitHub `production` environment for required-reviewers gating (configured in repo Settings, not in YAML).

Plus `uptime.yml` — pings `/.well-known/oauth-authorization-server` every 5 min, opens a deduped `uptime`-labelled issue on three consecutive failures, auto-closes on recovery.

Third-party actions are SHA-pinned with version comments. Dependabot keeps both pinned actions and npm deps fresh weekly (`.github/dependabot.yml`).

## Operator runbook

`docs/runbook.md` covers token rotation, KV reset, DO migration, propsVersion bumps, deploy rollback, custom-domain DNS recovery. Read it before doing anything that affects existing sessions (rotating `COOKIE_ENCRYPTION_KEY` invalidates them all).

## Things to avoid

- Don't reference internal review artifacts (`REVIEW_*.md` are gitignored audit notes from the launch — never link them from tracked code or commit messages).
- Don't expose form-based write views (`create_comment`, `compose`, `edit_post`, `delete_post`) as MCP tools without first re-shaping the upstream view to `@api`. They use `@require_auth` which session-only and 500s on Bearer.
- Don't bypass the pre-push hook (`--no-verify`) without a good reason — it runs `make ci` and the only thing in CI that's slower is the contract job which doesn't run locally anyway.
