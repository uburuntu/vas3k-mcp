# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.2] - 2026-04-20

### Fixed

- **Perplexity tool calls now work again.** 1.1.0 dropped the JSON text duplicate alongside `structuredContent` to save a few bytes; turns out Perplexity (and likely other clients still rolling out structured-content support) treats an empty `content` array as a tool failure and surfaces it as an opaque "Error". Restored the spec-recommended duplicate — modern clients keep using `structuredContent` directly, older clients get the JSON in text. MCP Inspector, Claude Desktop, and Claude Code were already fine; this is a Perplexity-only fix.

## [1.1.1] - 2026-04-20

### Added

- **Big copy-on-click URL on the landing page** — power-user shortcut that lives between the read/write toggle and the per-client snippets. Click anywhere on it to copy; flips between `/mcp` and `/mcp-full` together with the toggle.

### Changed

- **Consent screen redesigned** to match the landing page (Ubuntu, card with shadow + rounded corners, warm-amber accent, the same `.button` pattern for primary + ghost actions). Same copy and security disclosures as before.

## [1.1.0] - 2026-04-20

First-class MCP polish — structured outputs, accurate annotations, and an agent-friendly description rewrite.

### Added

- **Structured tool output**: every read and write tool now ships an `outputSchema`. Responses arrive as typed `structuredContent` the model can parse directly instead of opaque JSON text.
- **Tool titles**: every tool has a human-readable display name distinct from its machine name (e.g. `get_user` → "Member profile"), surfaced in the tools list of MCP-aware clients.
- **Resources**: `vas3k://me` (live profile of the authenticated member, pinnable as ambient session context) and `vas3k://about` (server capability cheatsheet).
- **Prompt template** `weekly_digest` — guided "what happened in the club this week" walk, with optional `post_type` filter and `focus` topic argument.

### Changed

- Tool descriptions rewritten for AI agents — each one explains when to call the tool, what's in the response, and which fields chain into other tools (e.g. "use search_users first to find a slug").
- Per-tool annotation accuracy pass: writes now report `destructiveHint` / `idempotentHint` per their actual semantics (additive-idempotent for upvotes, destructive-idempotent for retracts, destructive-non-idempotent for toggles). MCP-aware clients use these to decide whether to confirm before calling and whether retry is safe.

## [1.0.0] - 2026-04-19

Public-launch polish.

### Added

- **`/install.md`** and **`/llms.txt`**: a Markdown install guide aimed at AI agents. Tell your agent _"open https://vas3k-mcp.rmbk.me/install.md and install it for me"_ and it has every URL and snippet it needs.
- **Connection-builder on the landing page**: one toggle ("Разрешить действия от моего имени") flips every snippet between `/mcp` and `/mcp-full`.
- **More clients on the landing page**: ChatGPT (Web), Perplexity (Web), and a "Custom MCP server" walkthrough alongside the existing Claude Desktop, Claude Code, Cursor, and MCP Inspector entries.
- **Hero squircle** with cursor-following hover tilt and a triple-click spin easter egg.
- **Tool annotations** (`readOnlyHint`, `destructiveHint`, `idempotentHint`) on every MCP tool so MCP-aware hosts can auto-allow read-only calls without prompting.

### Changed

- Russian copy refresh across the landing and consent screen.
- "Что это и зачем" rewritten with three concrete use-case examples (weekly digest, expert search, long-thread summary).

### Fixed

- Write tools no longer 403 when the MCP client omits `scope=` from its authorize request.
- `/authorize` now strictly requires PKCE `code_challenge` (S256). Clients omitting it could previously bypass PKCE entirely.

### Security

- Uptime workflow neutralised against template-literal injection from upstream response bodies.

## [0.1.0] - 2026-04-19

### Added

- 12 read-only MCP tools exposed on `/mcp` (feed, posts, comments, rooms, users, search — read-only surface of the vas3k.club API).
- 11 write-capable MCP tools exposed on `/mcp-full` (upvote, bookmark, retract, subscribe/unsubscribe to posts and rooms, mute room, friend management — all require an upstream token).
- Dual-OAuth bridge: MCP client OAuth flow on the worker side, vas3k.club OAuth flow on the upstream side, with upstream tokens encrypted at rest in KV via `@cloudflare/workers-oauth-provider`.
- Russian-language landing page at `/` describing the project, both endpoints, and the full tool inventory.
- Weekly contract-test workflow (`.github/workflows/contract.yml`) that boots the real vas3k.club Django stack (postgres + redis + Django dev server) and runs zod-schema assertions against every documented tool, so upstream API drift is caught before users see it.
- Dependabot configuration for `github-actions` and `npm` ecosystems with weekly schedules; minor + patch npm bumps grouped to keep review noise down.
- Custom production domain at [vas3k-mcp.rmbk.me](https://vas3k-mcp.rmbk.me).

[Unreleased]: https://github.com/uburuntu/vas3k-mcp/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/uburuntu/vas3k-mcp/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/uburuntu/vas3k-mcp/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/uburuntu/vas3k-mcp/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/uburuntu/vas3k-mcp/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/uburuntu/vas3k-mcp/releases/tag/v0.1.0
