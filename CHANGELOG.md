# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- 11 write-capable MCP tools exposed on `/mcp-full` (upvote, bookmark, retract, subscribe/unsubscribe to posts and rooms, mute room, friend management — все требуют upstream-токен).
- Dual-OAuth bridge: MCP client OAuth flow on the worker side, vas3k.club OAuth flow on the upstream side, with upstream tokens encrypted at rest in KV via `@cloudflare/workers-oauth-provider`.
- Russian-language landing page at `/` describing the project, both endpoints, and the full tool inventory.
- Weekly contract-test workflow (`.github/workflows/contract.yml`) that boots the real vas3k.club Django stack (postgres + redis + Django dev server) and runs zod-schema assertions against every documented tool, so upstream API drift is caught before users see it.
- Dependabot configuration for `github-actions` and `npm` ecosystems with weekly schedules; minor + patch npm bumps grouped to keep review noise down.
- Custom production domain at [vas3k-mcp.rmbk.me](https://vas3k-mcp.rmbk.me).

[Unreleased]: https://github.com/uburuntu/vas3k-mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/uburuntu/vas3k-mcp/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/uburuntu/vas3k-mcp/releases/tag/v0.1.0
