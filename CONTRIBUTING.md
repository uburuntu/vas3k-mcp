# Contributing to vas3k-mcp

`vas3k-mcp` is a hosted remote MCP server for [vas3k.club](https://vas3k.club), running on Cloudflare Workers. It bridges MCP clients (Claude Desktop, Claude Code, Cursor, etc.) to the vas3k.club API via a dual-OAuth flow.

## Adding a new MCP tool

### Read tool (lands on `/mcp`)

1. **`src/vas3k-client.ts`** — add a method on the client class that wraps the upstream endpoint. Reuse the shared `request()` helper so timeouts, redaction, and error mapping stay consistent.
2. **`src/mcp.ts`** — register the tool with `this.server.registerTool(...)`. Define the input schema with `zod` (mirror upstream parameter names) and route the call through the existing `wrap()` helper for consistent error envelopes.
3. **`src/landing.ts`** — add a tile to the **"Только чтение"** group inside the tool grid.
4. **`test/contract/vas3k-club.test.ts`** — add a contract test if the tool has live-API meaning (i.e. the response shape can drift). Schema lives in `test/contract/schemas.ts`.

### Write tool (lands on `/mcp-full`)

Same four steps, but:

- Register on **`src/mcp-full.ts`** instead of `src/mcp.ts`.
- Add the tile to the **"Действия от твоего имени"** group in `src/landing.ts`.
- Verify the upstream Django view is decorated with `@api(require_auth=True)` — write tools must require an authenticated upstream token, otherwise the dual-OAuth bridge has no purpose.

## Local dev loop

```bash
make install                     # pnpm install
make hooks                       # one-time: enable .githooks/pre-push (runs `make ci`)
cp .dev.vars.example .dev.vars   # then fill VAS3K_CLIENT_ID/SECRET and a 32-byte hex COOKIE_ENCRYPTION_KEY
make dev                         # wrangler dev on http://localhost:8788
make ci                          # typecheck + lint + test (the pre-push hook runs this for you)
```

`make help` lists every target. The pre-push hook is local-only — bypass with
`git push --no-verify` for the rare case you need it.

## Contract tests

Schema-shape tests run against a real vas3k.club Django stack. CI does this automatically (see `.github/workflows/contract.yml`); to reproduce locally:

1. Clone `vas3k/vas3k.club` and bring up its `docker-compose` (postgres + redis + Django on `:8000`).
2. From inside that repo, bootstrap the fixtures (CI bot user, OAuth app, post, room, friend):

   ```bash
   python3 manage.py shell -c "$(cat /path/to/vas3k-mcp/ci/bootstrap.py)"
   ```

   The script prints `KEY=value` sentinels — grab `SERVICE_TOKEN`, `POST_SLUG`, `ROOM_SLUG`, `FRIEND_SLUG`.
3. Back in this repo, export and run:

   ```bash
   export VAS3K_BASE_URL=http://localhost:8000
   export VAS3K_SERVICE_TOKEN=<paste>
   export VAS3K_TEST_POST_SLUG=<paste>
   export VAS3K_TEST_ROOM_SLUG=<paste>
   export VAS3K_TEST_FRIEND_SLUG=<paste>
   pnpm test
   ```

## PR checklist

- [ ] `make ci` passes locally (the pre-push hook runs this automatically).
- [ ] Contract test added in `test/contract/vas3k-club.test.ts` if the change touches an upstream endpoint.
- [ ] `README.md` updated if user-visible behavior or setup steps change.
- [ ] `pnpm exec biome check --write .` is clean (no diff).
- [ ] Any new GitHub Actions step follows the SHA-pin convention below.

## SHA-pin convention

Third-party actions in `.github/workflows/*.yml` are pinned to a full 40-char commit SHA with a trailing `# vN.M.K` version comment. A floating tag would otherwise let an upstream re-point ship attacker-controlled code into a job that can hold `CLOUDFLARE_API_TOKEN`.

```yaml
- uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v5.0.0
```

GitHub-owned actions (`actions/checkout`, `actions/setup-node`, `actions/setup-python`, `actions/upload-artifact`) float on major tags (`@v6`) — they are maintained by GitHub directly, so the supply-chain risk is materially lower and constant SHA churn would create review friction. Dependabot watches both groups weekly (see `.github/dependabot.yml`).
