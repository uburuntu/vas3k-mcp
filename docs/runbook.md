# Operator runbook

Short playbooks for the things that wake you up. Architecture lives in [CLAUDE.md](../CLAUDE.md) — read that first if you've never deployed this worker.

## Rotate `COOKIE_ENCRYPTION_KEY`

Used to HMAC-sign the OAuth state tokens (`src/vas3k-handler.ts`). Rotation invalidates any in-flight `/authorize` flows but does NOT log existing users out — issued tokens remain valid.

```sh
openssl rand -base64 32 | pnpm exec wrangler secret put COOKIE_ENCRYPTION_KEY
```

If the key was leaked, also reset `OAUTH_KV` (next section).

## Rotate the upstream OAuth credentials

If `VAS3K_CLIENT_SECRET` leaks, rotate at `vas3k.club/apps/`:

1. Open the app's settings page.
2. Reset the client secret.
3. `pnpm exec wrangler secret put VAS3K_CLIENT_SECRET` with the new value.

Existing users' upstream tokens remain valid — only token refreshes use the new secret.

## Reset `OAUTH_KV` (force everyone to re-auth)

The `@cloudflare/workers-oauth-provider` library namespaces keys under `client:*`, `grant:*`, `token:*`. To wipe everything, use the Cloudflare dashboard:

> KV → `vas3k-mcp-oauth` → "Delete all keys"

Faster and safer than scripting it. After this, every MCP client must re-run `/authorize` and every registered MCP-side OAuth client must re-register.

To inspect first:

```sh
pnpm exec wrangler kv:key list --binding=OAUTH_KV
```

## Bump `Props` shape (`CURRENT_PROPS_VERSION`)

When you add a required field to `Props` (`src/types.ts`):

1. Bump `CURRENT_PROPS_VERSION` in `src/constants.ts`.
2. Deploy.
3. Old refresh attempts log `[props-version-mismatch]` and 401. MCP clients should re-run `/authorize` automatically.

If a field becomes optional or is removed, you do NOT need to bump — the existing tokens will keep working.

## Add a Durable Object class

DO classes are migration-tracked in `wrangler.jsonc`. Append a new tag (don't edit existing ones):

```jsonc
"migrations": [
  { "tag": "v1", "new_sqlite_classes": ["MyMCP"] },
  { "tag": "v2", "new_sqlite_classes": ["MyMCPFull"] },
  { "tag": "v3", "new_sqlite_classes": ["YourNewClass"] }
]
```

Don't `delete_classes` without a migration plan — DO state is gone for good. If you rename an existing class, that counts as delete + new and the SQLite state moves with the new tag.

## Deploy rollback

```sh
pnpm exec wrangler deployments list
pnpm exec wrangler rollback <deployment-id>
```

Two near-simultaneous main pushes both ship serially — latest wins. To abort an in-flight deploy, cancel it from the GitHub Actions UI before it reaches the wrangler step.

## Custom-domain DNS recovery

The worker is bound to `vas3k-mcp.rmbk.me` via Cloudflare custom domain (`wrangler.jsonc` → `routes`). If the domain stops resolving:

1. Cloudflare DNS tab — check the proxied CNAME for `vas3k-mcp.rmbk.me` exists.
2. Workers & Pages → vas3k-mcp → Settings → Domains & Routes — confirm the route is bound.
3. If the route was deleted, `pnpm exec wrangler deploy` re-adds it from `wrangler.jsonc`.

## Uptime alert fired

The `uptime` workflow opens a labelled issue when `/.well-known/oauth-authorization-server` 5xxs three times in a row.

1. `pnpm exec wrangler tail` — look for `[upstream-*]`, `[mcp tool failure]`, `[props-version-mismatch]`.
2. `curl -I https://vas3k-mcp.rmbk.me/.well-known/oauth-authorization-server` from your laptop.
3. Cloudflare status page.
4. Is vas3k.club itself up? Half our 5xxs are upstream weather.

The issue auto-closes when the probe recovers.

## Force a no-op redeploy

Trigger `workflow_dispatch` from the Deploy workflow page in GitHub Actions. Useful when CF cached a stale Worker bundle or you want to verify a config change without a code commit.
