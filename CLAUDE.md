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

Plus `uptime.yml` — pings `/.well-known/oauth-authorization-server` hourly, opens a deduped `uptime`-labelled issue on three consecutive failures, auto-closes on recovery.

Third-party actions are SHA-pinned with version comments. Dependabot keeps both pinned actions and npm deps fresh weekly (`.github/dependabot.yml`).

## Operator runbook

`docs/runbook.md` covers token rotation, KV reset, DO migration, propsVersion bumps, deploy rollback, custom-domain DNS recovery. Read it before doing anything that affects existing sessions (rotating `COOKIE_ENCRYPTION_KEY` invalidates them all).

## Versioning and releases

`VERSION` (single-line semver at repo root) is the version source of truth. `package.json`'s `version` field mirrors it for npm metadata — bump both together. Bump when you ship something users can perceive; not for docs-only commits, CI tweaks, or comment fixes.

`CHANGELOG.md` is **end-user-facing**, not a commit log or development diary. The audience is someone deciding whether to upgrade or self-hosters reviewing what changed.

Goes in:

- New features users will see, use, or call.
- Behavioural changes users will notice (default flips, error responses, scope handling).
- Security fixes that affect users' data or sessions (with enough context to assess impact).
- Bug fixes for issues users actually hit.

Does NOT go in:

- Internal refactors, comment fixes, naming tweaks, file moves.
- CI / lint / typecheck / test plumbing.
- Internal docs (CLAUDE.md, runbook edits, README cleanups).
- Mini-fixes that landed inside one working session and only matter to the implementer (a typo in a header comment, a one-line revert, a Bezier path that was wrong on first try).
- Exploratory work that didn't ship a user-visible change.

If a release section would be empty after applying these filters, don't cut a release.

Release flow:

1. While building, drop user-facing changes under `[Unreleased]` in `CHANGELOG.md`. Skip the entry entirely if the change isn't user-facing.
2. Cutting a release:
   - Move `[Unreleased]` content under a new `[X.Y.Z] - YYYY-MM-DD` heading.
   - Bump `VERSION` and `package.json`'s `version`.
   - Update the bottom-of-file compare links in `CHANGELOG.md`.
   - Commit (`chore: release X.Y.Z`) and push to `main`.

That's it. `.github/workflows/release.yml` watches for `VERSION`-file changes on `main`, creates the `vX.Y.Z` tag at the head commit, and posts a GitHub release with the matching `CHANGELOG.md` section as the body. The workflow is idempotent — re-runs no-op if the release already exists.

If the auto-fire misses (e.g. you fixed something post-bump and squashed VERSION into an unrelated commit, or you need to recreate a release), trigger manually:

```sh
gh workflow run release.yml                          # uses VERSION file
gh workflow run release.yml -f version=1.2.3         # explicit
```

The deploy workflow does NOT gate on `VERSION` — `main` is what ships. Tagging is purely bookkeeping for humans, forks, and the GitHub Releases page.

## Copy, voice, and branding

Heavy copy polish landed in 1.0.0. Preserve these rules so the next iteration doesn't undo them.

### Russian voice

Applies to `src/landing.ts` and the consent screen in `src/vas3k-handler.ts`.

- `ты`, never `вы`. No gendered slash forms (`запускал/-а` style — restructure or use the masculine generic, e.g. "Если подключал не ты").
- No marketing / corporate phrasing. Direct, dry, slightly ironic — the vas3k.club voice.
- Tech anglicisms OK where they're standard (OAuth, slug, MCP, JSON, API, Markdown). Prefer Russian otherwise: `закладки` not `букмарки`, `комментарии` (full form) not `комменты` / `коммента`, `URL` not `эндпоинт`.
- Don't use `Claude` / `Cursor` as stand-ins for "any AI client" — they were scrubbed out of meta descriptions, the hero subtitle, the README intro and example phrasings. Use `AI` / `AI-ассистент`. Brand names are only kept where they're load-bearing: per-client install sections (landing + `install-md.ts`), README architecture diagram, internal source comments.

### Hero direction: Клуб → AI

The hero subtitle frames the Club as the resource and AI as the consumer (`Подключи Клуб к своему AI — чтобы умел искать людей, цитировать посты и подтягивать ссылки прямо в чате`). The inverted framing ("let your AI read the Club for you") was rejected because vas3k.club's value is real human reading and engagement — AI as substitute cuts against that. Verbs to favour: `искать`, `цитировать`, `подтягивать`. Verbs to avoid for AI actions: `читать`, `пересказывать`, `копаться в ленте`.

When you change hero copy, sweep all the public-positioning surfaces so they stay aligned:

- `<title>`, `<meta name="description">`, `og:title` / `og:description`, `twitter:title` / `twitter:description` in `src/landing.ts` head.
- Hero `h1` + subtitle paragraph in the same file.
- `name` / `description` in `public/site.webmanifest`.
- `description` in `package.json`.
- The intro line in `src/install-md.ts`.
- GitHub repo About: `gh repo edit --description "…"`.

### Branding facts

The real vas3k.club mark is `✖️`. The avocado-with-headphones in `public/img/hero.webp` (also `readme-hero.webp`, `og.{webp,png}`) is **not** canonical club branding — it's a user-supplied illustration that we adopted as our own mascot. Across the entire `vas3k/vas3k.club` source the avocado emoji appears exactly once, as the tag emoji for `healthy-food` (`reference/common/data/tags.py:75`). Don't reintroduce 🥑 as if it were the club logo (e.g. in the hero tag), and don't pad copy with avocado puns. The mascot is a knowing in-joke, not corporate identity.

### Layout note

The `.agent-hint` callout under "Как подключить" lives **outside** the section's `<section class="block">` — as a sibling, not a child. Fighting margin-top inside the block didn't produce a visible gap (block padding-bottom + section margin-bottom were eating the perceived spacing); making it a sibling lets section-level spacing handle the separation. If you reorganise the page, keep the callout outside section blocks.

## Things to avoid

- Don't reference internal review artifacts (`REVIEW_*.md` are gitignored audit notes from the launch — never link them from tracked code or commit messages).
- Don't expose form-based write views (`create_comment`, `compose`, `edit_post`, `delete_post`) as MCP tools without first re-shaping the upstream view to `@api`. They use `@require_auth` which session-only and 500s on Bearer.
- Don't bypass the pre-push hook (`--no-verify`) without a good reason — it runs `make ci` and the only thing in CI that's slower is the contract job which doesn't run locally anyway.
