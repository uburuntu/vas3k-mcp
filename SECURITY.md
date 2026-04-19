# Security Policy

## Reporting a vulnerability

Please **do not open a public GitHub issue** for security problems.

Report privately via [GitHub Security Advisories](https://github.com/uburuntu/vas3k-mcp/security/advisories/new). That channel is monitored by the maintainer ([@uburuntu](https://github.com/uburuntu)).

Include, where possible: a clear description, reproduction steps or a proof-of-concept, the affected commit/version, and any suggested mitigation.

## Scope

In scope:

- The Cloudflare Worker source under `src/`.
- The dual-OAuth flow (`/authorize`, `/callback`, `/token`, `/register`) and the way upstream vas3k.club tokens are persisted. Upstream access and refresh tokens are stored in `props` on the OAuth grant, which `@cloudflare/workers-oauth-provider` encrypts with AES-GCM keyed by the issued bearer — only token holders can decrypt them.
- The MCP endpoints `/mcp` and `/mcp-full` and their input validation.
- The CI/CD workflows under `.github/workflows/` and the secrets they handle.

Out of scope (please report upstream):

- vas3k.club itself — report to [vas3k/vas3k.club](https://github.com/vas3k/vas3k.club).
- The MCP protocol specification — report to [modelcontextprotocol](https://github.com/modelcontextprotocol).

## SLA

Best-effort acknowledgement within 48 hours. There is no formal bug-bounty program.

## Hardening already in place

- `allowPlainPKCE: false` — only S256 code challenges are accepted.
- `allowImplicitFlow: false` — only the authorization-code flow is enabled.
- Strict input validation on user slugs, UUIDs, and Telegram IDs before they reach the upstream API.
- Upstream OAuth requests use `redirect: "manual"` and `AbortSignal` timeouts, so the worker cannot be coerced into following arbitrary redirects or hung by a slow upstream.
- Secret redaction in error responses — bearer tokens and service-token patterns are stripped before any error body is surfaced to MCP clients.
- The consent screen renders the registered `client_id` verbatim, so the user always sees the actual identifier rather than an attacker-controlled display string.
- All third-party GitHub Actions in CI are pinned to full 40-char commit SHAs (with `# vN.M.K` comments); Dependabot keeps the pins fresh weekly.
